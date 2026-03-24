defmodule LeadResearcher.Crawler.Runner do
  require Logger

  alias LeadResearcher.{Jobs, Leads, Enrichments}
  alias LeadResearcher.Enrichments.EnrichmentRuns
  alias LeadResearcher.Leads.Lead
  alias LeadResearcher.Crawler.Bridge
  alias LeadResearcher.Dedup
  alias LeadResearcher.Validation.EmailValidator
  alias LeadResearcher.ContactAnalyzer
  alias LeadResearcher.TagNormalizer
  alias LeadResearcher.AutoReviewer

  def run(job_id) do
    job = Jobs.get_job!(job_id)
    targets = Jason.decode!(job.targets)

    keywords =
      if job.keywords do
        case Jason.decode(job.keywords) do
          {:ok, list} when is_list(list) -> list
          _ -> []
        end
      else
        []
      end

    category_tags =
      if job.category_tags do
        case Jason.decode(job.category_tags) do
          {:ok, list} when is_list(list) -> list
          _ -> []
        end
      else
        []
      end

    config = %{
      "mode" => job.mode || "url",
      "targets" => targets,
      "keywords" => keywords,
      "category_tags" => category_tags,
      "platform" => job.platform,
      "subscriber_min" => job.subscriber_min,
      "subscriber_max" => job.subscriber_max,
      "max_retries" => job.max_retries,
      "delay_ms" => job.delay_ms,
      "max_depth" => job.max_depth,
      "target_count" => job.target_count
    }

    Logger.info("Starting #{job.mode || "url"} crawl for job #{job_id}")

    count_ref = :counters.new(1, [:atomics])

    on_lead = fn lead_data ->
      if valid_lead?(lead_data) do
        case process_lead(lead_data, job_id) do
          {:ok, _} ->
            email = lead_data["email"]
            has_email = is_binary(email) and email != ""

            # Only count leads WITH email toward total_leads_found
            # (aligns with Python crawler's qualified_count)
            if has_email do
              :counters.add(count_ref, 1, 1)
              count = :counters.get(count_ref, 1)
              Jobs.update_job(job, %{total_leads_found: count})

              # First qualified lead found: running → partial_results
              if count == 1 do
                Jobs.update_job_status(job_id, "partial_results")
              end
            end

          {:skip, _} ->
            :ok

          {:error, reason} ->
            Logger.warning("Failed to save lead: #{inspect(reason)}")
        end
      end
    end

    on_summary = fn summary_data ->
      Logger.info(
        "Job #{job_id} summary: #{inspect(summary_data)}"
      )

      termination_reason = summary_data["termination_reason"]
      crawl_stats = Jason.encode!(summary_data)

      Jobs.update_job(job, %{
        termination_reason: termination_reason,
        crawl_stats: crawl_stats
      })
    end

    case Bridge.run(config, on_lead, on_summary) do
      :ok ->
        count = :counters.get(count_ref, 1)
        Logger.info("Job #{job_id} completed. #{count} new leads saved.")
        :ok

      {:error, :timeout} ->
        Logger.error("Job #{job_id} timed out")
        Jobs.update_job(job, %{termination_reason: "timeout"})
        {:error, :timeout}

      {:error, reason} ->
        Logger.error("Job #{job_id} failed: #{inspect(reason)}")
        Jobs.update_job(job, %{termination_reason: "system_error"})
        {:error, reason}
    end
  end

  @doc """
  Backfill subscriber_count for leads in a job that are missing it.
  Visits each channel page, extracts subscriber count, updates the lead.
  """
  def run_enrich_subscribers(job_id, run_id \\ nil) do
    missing = Leads.list_leads_missing_subscribers(job_id)

    if missing == [] do
      Logger.info("Job #{job_id}: no leads missing subscriber_count")
      if run_id, do: EnrichmentRuns.complete(run_id)
      {:ok, 0}
    else
      Logger.info("Job #{job_id}: backfilling subscriber_count for #{length(missing)} leads")

      leads_payload =
        Enum.map(missing, fn %{id: id, channel_url: url} ->
          %{"lead_id" => id, "channel_url" => url}
        end)

      config = %{
        "mode" => "enrich_subscribers",
        "leads" => leads_payload,
        "delay_ms" => 2000,
        "max_retries" => 3
      }

      count_ref = :counters.new(1, [:atomics])

      callbacks = %{
        on_subscriber_update: fn data ->
          lead_id = data["lead_id"]
          subscriber_count = data["subscriber_count"]

          case Leads.backfill_subscriber_count(lead_id, subscriber_count) do
            {:ok, _} ->
              :counters.add(count_ref, 1, 1)
              if run_id, do: EnrichmentRuns.increment_processed(run_id)
              Logger.info("Backfilled lead #{lead_id}: #{subscriber_count} subscribers")

            {:error, reason} ->
              if run_id, do: EnrichmentRuns.increment_failed(run_id)
              Logger.warning("Failed to backfill lead #{lead_id}: #{inspect(reason)}")
          end
        end,
        on_subscriber_failure: fn data ->
          lead_id = data["lead_id"]
          reason = data["failure_reason"]

          case Leads.set_audience_failure_reason(lead_id, reason) do
            {:ok, _} ->
              if run_id, do: EnrichmentRuns.increment_failed(run_id)
              Logger.info("Set failure reason for lead #{lead_id}: #{reason}")

            {:error, err} ->
              if run_id, do: EnrichmentRuns.increment_failed(run_id)
              Logger.warning("Failed to set failure reason for lead #{lead_id}: #{inspect(err)}")
          end
        end,
        on_summary: fn summary ->
          Logger.info("Subscriber backfill summary: #{inspect(summary)}")
        end
      }

      result = case Bridge.run(config, callbacks) do
        :ok ->
          updated = :counters.get(count_ref, 1)
          Logger.info("Job #{job_id}: subscriber backfill done. #{updated} leads updated.")
          if run_id, do: EnrichmentRuns.complete(run_id)
          {:ok, updated}

        {:error, reason} ->
          Logger.error("Job #{job_id}: subscriber backfill failed: #{inspect(reason)}")
          if run_id, do: EnrichmentRuns.mark_failed(run_id)
          {:error, reason}
      end

      result
    end
  end

  @doc """
  Enrich leads in a job with channel page data (profile, tags, etc.).
  Visits each channel page, extracts enrichment data, saves to lead_enrichments.
  """
  def run_enrich_channels(job_id, run_id \\ nil) do
    candidates = Leads.list_leads_for_enrichment(job_id)

    if candidates == [] do
      Logger.info("Job #{job_id}: no leads need enrichment")
      if run_id, do: EnrichmentRuns.complete(run_id)
      {:ok, 0}
    else
      Logger.info("Job #{job_id}: enriching #{length(candidates)} leads")

      leads_payload =
        Enum.map(candidates, fn %{id: id, channel_url: url} ->
          %{"lead_id" => id, "channel_url" => url}
        end)

      config = %{
        "mode" => "enrich_channels",
        "leads" => leads_payload,
        "delay_ms" => 2000,
        "max_retries" => 3
      }

      count_ref = :counters.new(1, [:atomics])

      callbacks = %{
        on_enrichment: fn data ->
          lead_id = data["lead_id"]

          case Enrichments.auto_enrich(lead_id, data) do
            {:ok, _} ->
              :counters.add(count_ref, 1, 1)
              if run_id, do: EnrichmentRuns.increment_processed(run_id)
              Logger.info("Enriched lead #{lead_id}")

            {:error, reason} ->
              if run_id, do: EnrichmentRuns.increment_failed(run_id)
              Logger.warning("Failed to enrich lead #{lead_id}: #{inspect(reason)}")
          end
        end,
        on_summary: fn summary ->
          Logger.info("Channel enrichment summary: #{inspect(summary)}")
        end
      }

      result = case Bridge.run(config, callbacks) do
        :ok ->
          enriched = :counters.get(count_ref, 1)
          Logger.info("Job #{job_id}: channel enrichment done. #{enriched} leads enriched.")
          if run_id, do: EnrichmentRuns.complete(run_id)
          {:ok, enriched}

        {:error, reason} ->
          Logger.error("Job #{job_id}: channel enrichment failed: #{inspect(reason)}")
          if run_id, do: EnrichmentRuns.mark_failed(run_id)
          {:error, reason}
      end

      result
    end
  end

  defp valid_lead?(lead_data) do
    email = lead_data["email"]
    evidence = lead_data["evidence_link"]

    cond do
      is_nil(evidence) || evidence == "" -> false
      is_nil(email) || email == "" -> true
      true -> EmailValidator.valid?(email)
    end
  end

  defp process_lead(lead_data, job_id) do
    email = lead_data["email"]
    platform = lead_data["platform"] || "unknown"
    sub_count = lead_data["subscriber_count"]

    email_status =
      cond do
        is_nil(email) or email == "" -> "missing"
        EmailValidator.valid?(email) -> "valid_syntax"
        true -> "invalid_syntax"
      end

    audience_metric_type =
      case platform do
        "youtube" -> "subscriber"
        "instagram" -> "follower"
        _ -> "unknown"
      end

    # Compute contact readiness
    {contact_readiness, suspect_reason} =
      ContactAnalyzer.classify(email, lead_data["channel_name"])

    attrs = %{
      email: email,
      platform: platform,
      channel_name: lead_data["channel_name"],
      channel_url: lead_data["channel_url"],
      evidence_link: lead_data["evidence_link"],
      confidence_score: lead_data["confidence_score"] || 0.5,
      subscriber_count: sub_count,
      source_platform: lead_data["source_platform"],
      source_type: lead_data["source_type"],
      source_url: lead_data["source_url"],
      discovery_keyword: lead_data["discovery_keyword"],
      discovery_keywords: build_discovery_keywords_json(lead_data["discovery_keyword"]),
      normalized_tags: build_normalized_tags_json(lead_data["discovery_keyword"]),
      raw_data: Jason.encode!(lead_data),
      job_id: job_id,
      status: if(email, do: "scraped", else: "manual_review"),
      email_status: email_status,
      audience_metric_type: audience_metric_type,
      audience_tier: Lead.compute_audience_tier(sub_count),
      audience_source: "crawler",
      contact_readiness: contact_readiness,
      suspect_reason: suspect_reason
    }

    # Audience extraction trace
    Logger.info("[runner] Lead #{lead_data["channel_name"] || email}: subscriber_count=#{inspect(sub_count)}, tier=#{inspect(attrs[:audience_tier])}, platform=#{platform}")

    # Auto-classify review status
    attrs = Map.put(attrs, :review_status, AutoReviewer.classify(attrs))

    case Dedup.check(attrs) do
      :new -> Leads.create_lead(attrs)
      :duplicate -> {:skip, :duplicate}
      {:merge, existing} -> Leads.merge_lead(existing, attrs)
    end
  end

  defp build_discovery_keywords_json(nil), do: nil
  defp build_discovery_keywords_json(""), do: nil

  defp build_discovery_keywords_json(keyword) do
    Jason.encode!([keyword])
  end

  defp build_normalized_tags_json(nil), do: nil
  defp build_normalized_tags_json(""), do: nil

  defp build_normalized_tags_json(keyword) do
    case TagNormalizer.normalize([keyword]) do
      [] -> nil
      tags -> Jason.encode!(tags)
    end
  end
end

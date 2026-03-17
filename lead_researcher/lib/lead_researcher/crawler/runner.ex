defmodule LeadResearcher.Crawler.Runner do
  require Logger

  alias LeadResearcher.{Jobs, Leads}
  alias LeadResearcher.Crawler.Bridge
  alias LeadResearcher.Dedup
  alias LeadResearcher.Validation.EmailValidator

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
            :counters.add(count_ref, 1, 1)
            count = :counters.get(count_ref, 1)
            Jobs.update_job(job, %{total_leads_found: count})

          {:skip, _} ->
            :ok

          {:error, reason} ->
            Logger.warning("Failed to save lead: #{inspect(reason)}")
        end
      end
    end

    case Bridge.run(config, on_lead) do
      :ok ->
        count = :counters.get(count_ref, 1)
        Logger.info("Job #{job_id} completed. #{count} new leads saved.")
        :ok

      {:error, reason} ->
        Logger.error("Job #{job_id} failed: #{inspect(reason)}")
        {:error, reason}
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
    attrs = %{
      email: lead_data["email"],
      platform: lead_data["platform"] || "unknown",
      channel_name: lead_data["channel_name"],
      channel_url: lead_data["channel_url"],
      evidence_link: lead_data["evidence_link"],
      confidence_score: lead_data["confidence_score"] || 0.5,
      subscriber_count: lead_data["subscriber_count"],
      raw_data: Jason.encode!(lead_data),
      job_id: job_id,
      status: if(lead_data["email"], do: "scraped", else: "manual_review")
    }

    case Dedup.check(attrs) do
      :new -> Leads.create_lead(attrs)
      :duplicate -> {:skip, :duplicate}
      {:merge, existing} -> Leads.merge_lead(existing, attrs)
    end
  end
end

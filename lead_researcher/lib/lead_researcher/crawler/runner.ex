defmodule LeadResearcher.Crawler.Runner do
  require Logger

  alias LeadResearcher.{Jobs, Leads}
  alias LeadResearcher.Crawler.Bridge
  alias LeadResearcher.Dedup
  alias LeadResearcher.Validation.EmailValidator

  def run(job_id) do
    job = Jobs.get_job!(job_id)
    targets = Jason.decode!(job.targets)

    config = %{
      "targets" => targets,
      "max_retries" => job.max_retries,
      "delay_ms" => job.delay_ms,
      "max_depth" => job.max_depth
    }

    Logger.info("Starting crawl for job #{job_id} with #{length(targets)} targets")

    case Bridge.run(config) do
      leads when is_list(leads) ->
        count =
          leads
          |> Enum.filter(&valid_lead?/1)
          |> Enum.reduce(0, fn lead_data, count ->
            case process_lead(lead_data, job_id) do
              {:ok, _} -> count + 1
              {:skip, _} -> count
              {:error, reason} ->
                Logger.warning("Failed to save lead: #{inspect(reason)}")
                count
            end
          end)

        Jobs.update_job(job, %{total_leads_found: count})
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

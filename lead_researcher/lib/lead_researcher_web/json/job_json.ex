defmodule LeadResearcherWeb.JobJSON do
  alias LeadResearcher.Jobs.Job

  def index(%{jobs: jobs}), do: %{data: for(job <- jobs, do: data(job))}
  def show(%{job: job}), do: %{data: data(job)}

  defp data(%Job{} = job) do
    target = job.target_count || 0
    collected = job.total_leads_found || 0
    percentage = if target > 0, do: min(round(collected / target * 100), 100), else: 0

    %{
      id: job.id,
      label: job.label,
      targets: safe_decode_json(job.targets, []),
      status: job.status,
      platform: job.platform,
      category_tags: safe_decode_json(job.category_tags, []),
      target_count: job.target_count,
      subscriber_min: job.subscriber_min,
      subscriber_max: job.subscriber_max,
      extra_conditions: job.extra_conditions,
      max_retries: job.max_retries,
      delay_ms: job.delay_ms,
      max_depth: job.max_depth,
      total_leads_found: collected,
      error_message: job.error_message,
      started_at: job.started_at,
      completed_at: job.completed_at,
      inserted_at: job.inserted_at,
      updated_at: job.updated_at,
      progress: %{
        collected: collected,
        target: target,
        percentage: percentage
      }
    }
  end

  defp safe_decode_json(nil, default), do: default
  defp safe_decode_json(val, default) when is_binary(val) do
    case Jason.decode(val) do
      {:ok, result} -> result
      _ -> default
    end
  end
  defp safe_decode_json(_, default), do: default
end

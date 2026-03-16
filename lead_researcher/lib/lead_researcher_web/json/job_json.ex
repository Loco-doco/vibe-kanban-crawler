defmodule LeadResearcherWeb.JobJSON do
  alias LeadResearcher.Jobs.Job

  def index(%{jobs: jobs}), do: %{data: for(job <- jobs, do: data(job))}
  def show(%{job: job}), do: %{data: data(job)}

  defp data(%Job{} = job) do
    %{
      id: job.id,
      targets: Jason.decode!(job.targets),
      status: job.status,
      max_retries: job.max_retries,
      delay_ms: job.delay_ms,
      max_depth: job.max_depth,
      total_leads_found: job.total_leads_found,
      error_message: job.error_message,
      started_at: job.started_at,
      completed_at: job.completed_at,
      inserted_at: job.inserted_at,
      updated_at: job.updated_at
    }
  end
end

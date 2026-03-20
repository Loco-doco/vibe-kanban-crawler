defmodule LeadResearcher.Enrichments.EnrichmentRuns do
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Enrichments.EnrichmentRun

  def create(job_id, run_type, total) do
    %EnrichmentRun{}
    |> EnrichmentRun.changeset(%{job_id: job_id, run_type: run_type, total: total})
    |> Repo.insert()
  end

  def get!(id), do: Repo.get!(EnrichmentRun, id)

  def increment_processed(run_id) do
    from(r in EnrichmentRun, where: r.id == ^run_id)
    |> Repo.update_all(inc: [processed: 1, updated: 1])
  end

  def increment_failed(run_id) do
    from(r in EnrichmentRun, where: r.id == ^run_id)
    |> Repo.update_all(inc: [processed: 1, failed: 1])
  end

  def complete(run_id) do
    run = Repo.get!(EnrichmentRun, run_id)

    run
    |> EnrichmentRun.changeset(%{status: "completed"})
    |> Repo.update()
  end

  def mark_failed(run_id) do
    run = Repo.get!(EnrichmentRun, run_id)

    run
    |> EnrichmentRun.changeset(%{status: "failed"})
    |> Repo.update()
  end
end

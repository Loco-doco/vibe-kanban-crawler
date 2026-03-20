defmodule LeadResearcherWeb.JobController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.Jobs
  alias LeadResearcher.Leads
  alias LeadResearcher.Enrichments.EnrichmentRuns

  def index(conn, params) do
    jobs = Jobs.list_jobs(params)
    render(conn, :index, jobs: jobs)
  end

  def create(conn, %{"job" => job_params}) do
    with {:ok, job} <- Jobs.create_job(job_params) do
      LeadResearcher.Jobs.JobQueue.enqueue(job.id)

      conn
      |> put_status(:created)
      |> render(:show, job: job)
    else
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  def show(conn, %{"id" => id}) do
    job = Jobs.get_job!(id)
    render(conn, :show, job: job)
  end

  def parse_prompt(conn, %{"prompt" => prompt}) do
    case LeadResearcher.PromptParser.parse(prompt) do
      {:ok, result} ->
        json(conn, %{data: result})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: reason})
    end
  end

  def supplement(conn, %{"id" => id, "supplementary_type" => sup_type}) do
    case Jobs.create_supplementary_job(String.to_integer(id), sup_type) do
      {:ok, job} ->
        LeadResearcher.Jobs.JobQueue.enqueue(job.id)

        conn
        |> put_status(:created)
        |> render(:show, job: job)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  def enrich_subscribers(conn, %{"id" => id}) do
    job_id = String.to_integer(id)
    total = length(Leads.list_leads_missing_subscribers(job_id))

    case EnrichmentRuns.create(job_id, "subscribers", total) do
      {:ok, run} ->
        run_id = run.id

        Task.start(fn ->
          LeadResearcher.Crawler.Runner.run_enrich_subscribers(job_id, run_id)
        end)

        json(conn, %{status: "started", job_id: job_id, run_id: run_id})

      {:error, _} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "failed to create run"})
    end
  end

  def enrich_channels(conn, %{"id" => id}) do
    job_id = String.to_integer(id)
    total = length(Leads.list_leads_for_enrichment(job_id))

    case EnrichmentRuns.create(job_id, "channels", total) do
      {:ok, run} ->
        run_id = run.id

        Task.start(fn ->
          LeadResearcher.Crawler.Runner.run_enrich_channels(job_id, run_id)
        end)

        json(conn, %{status: "started", job_id: job_id, run_id: run_id})

      {:error, _} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "failed to create run"})
    end
  end

  def enrichment_run_status(conn, %{"id" => id}) do
    run = EnrichmentRuns.get!(String.to_integer(id))

    json(conn, %{
      data: %{
        id: run.id,
        job_id: run.job_id,
        run_type: run.run_type,
        status: run.status,
        total: run.total,
        processed: run.processed,
        updated: run.updated,
        failed: run.failed,
        inserted_at: run.inserted_at,
        updated_at: run.updated_at
      }
    })
  end

  def cancel(conn, %{"id" => id}) do
    LeadResearcher.Jobs.JobQueue.cancel(String.to_integer(id))

    case Jobs.cancel_job(String.to_integer(id)) do
      {:ok, job} -> render(conn, :show, job: job)
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end

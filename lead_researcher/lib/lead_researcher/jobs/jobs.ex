defmodule LeadResearcher.Jobs do
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Jobs.Job

  def list_jobs(params \\ %{}) do
    Job
    |> maybe_filter_status(params)
    |> order_by(desc: :inserted_at)
    |> limit(^Map.get(params, "limit", 50))
    |> offset(^Map.get(params, "offset", 0))
    |> Repo.all()
  end

  def get_job!(id), do: Repo.get!(Job, id)

  def create_job(attrs) do
    targets =
      case Map.get(attrs, "targets") || Map.get(attrs, :targets) do
        t when is_list(t) -> Jason.encode!(t)
        t when is_binary(t) -> t
        _ -> "[]"
      end

    category_tags =
      case Map.get(attrs, "category_tags") || Map.get(attrs, :category_tags) do
        t when is_list(t) -> Jason.encode!(t)
        t when is_binary(t) -> t
        _ -> nil
      end

    keywords =
      case Map.get(attrs, "keywords") || Map.get(attrs, :keywords) do
        t when is_list(t) -> Jason.encode!(t)
        t when is_binary(t) -> t
        _ -> nil
      end

    attrs =
      attrs
      |> Map.put("targets", targets)
      |> Map.put("category_tags", category_tags)
      |> Map.put("keywords", keywords)

    %Job{}
    |> Job.changeset(attrs)
    |> Repo.insert()
  end

  def update_job(%Job{} = job, attrs) do
    job
    |> Job.changeset(attrs)
    |> Repo.update()
  end

  def update_job_status(job_id, status, extra \\ %{}) do
    job = get_job!(job_id)
    attrs = Map.merge(%{status: status}, Map.new(extra))
    update_job(job, attrs)
  end

  def cancel_job(job_id) do
    update_job_status(job_id, "cancelled")
  end

  def list_pending_job_ids do
    Job
    |> where([j], j.status == "pending")
    |> order_by(asc: :inserted_at)
    |> select([j], j.id)
    |> Repo.all()
  end

  defp maybe_filter_status(query, %{"status" => status}) when is_binary(status) do
    where(query, [j], j.status == ^status)
  end

  defp maybe_filter_status(query, _), do: query
end

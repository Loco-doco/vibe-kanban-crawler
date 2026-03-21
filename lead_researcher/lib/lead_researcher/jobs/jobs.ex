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
    update_job_status(job_id, "cancelled", %{
      termination_reason: "user_cancelled",
      completed_at: DateTime.utc_now()
    })
  end

  def list_pending_job_ids do
    Job
    |> where([j], j.status == "queued")
    |> order_by(asc: :inserted_at)
    |> select([j], j.id)
    |> Repo.all()
  end

  @doc """
  Determines the final completion status based on termination_reason.

  - target_reached → completed
  - sources_exhausted / duplicate_heavy / insufficient_contact_coverage → completed_low_yield
  - timeout / system_error → failed
  - user_cancelled → cancelled
  """
  def determine_completion_status(job_id) do
    job = get_job!(job_id)

    case job.termination_reason do
      "target_reached" -> "completed"
      reason when reason in ~w(sources_exhausted duplicate_heavy insufficient_contact_coverage) -> "completed_low_yield"
      "timeout" -> "failed"
      "system_error" -> "failed"
      "user_cancelled" -> "cancelled"
      _ -> "completed"
    end
  end

  @doc """
  Create a supplementary job linked to a parent job.
  Copies platform, targets, keywords, category_tags, and crawler settings from the parent.
  """
  def create_supplementary_job(parent_job_id, supplementary_type) do
    parent = get_job!(parent_job_id)

    label_suffix =
      case supplementary_type do
        "email_supplement" -> "이메일 보완"
        "audience_supplement" -> "영향력 보완"
        "meta_supplement" -> "보강 보완"
        _ -> "보완"
      end

    parent_label = parent.label || "Job ##{parent.id}"

    attrs = %{
      "targets" => parent.targets,
      "platform" => parent.platform,
      "keywords" => parent.keywords,
      "category_tags" => parent.category_tags,
      "mode" => parent.mode || "url",
      "target_count" => parent.target_count,
      "subscriber_min" => parent.subscriber_min,
      "subscriber_max" => parent.subscriber_max,
      "max_retries" => parent.max_retries,
      "delay_ms" => parent.delay_ms,
      "max_depth" => parent.max_depth,
      "label" => "#{parent_label} - #{label_suffix}",
      "parent_job_id" => parent.id,
      "supplementary_type" => supplementary_type,
      "status" => "queued"
    }

    %Job{}
    |> Job.changeset(attrs)
    |> Repo.insert()
  end

  defp maybe_filter_status(query, %{"status" => status}) when is_binary(status) do
    where(query, [j], j.status == ^status)
  end

  defp maybe_filter_status(query, _), do: query
end

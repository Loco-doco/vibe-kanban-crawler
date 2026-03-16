defmodule LeadResearcher.Leads do
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Leads.Lead

  def list_leads(params \\ %{}) do
    Lead
    |> maybe_filter_job(params)
    |> maybe_filter_platform(params)
    |> maybe_filter_status(params)
    |> maybe_filter_min_confidence(params)
    |> maybe_search(params)
    |> apply_sort(params)
    |> limit(^parse_int(params, "limit", 50))
    |> offset(^parse_int(params, "offset", 0))
    |> Repo.all()
  end

  def get_lead!(id), do: Repo.get!(Lead, id)

  def create_lead(attrs) do
    %Lead{}
    |> Lead.changeset(attrs)
    |> Repo.insert()
  end

  def update_lead(%Lead{} = lead, attrs) do
    lead
    |> Lead.changeset(attrs)
    |> Repo.update()
  end

  def merge_lead(%Lead{} = existing, new_attrs) do
    merged =
      %{}
      |> maybe_merge_field(existing, new_attrs, :email)
      |> maybe_merge_field(existing, new_attrs, :channel_name)
      |> maybe_merge_field(existing, new_attrs, :subscriber_count)
      |> Map.put(:confidence_score, max(existing.confidence_score, new_attrs[:confidence_score] || 0.0))

    update_lead(existing, merged)
  end

  def find_by_email(nil), do: nil

  def find_by_email(email) do
    Repo.one(from l in Lead, where: l.email == ^email, limit: 1)
  end

  def find_by_channel_url(nil), do: nil

  def find_by_channel_url(url) do
    Repo.one(from l in Lead, where: l.channel_url == ^url, limit: 1)
  end

  def find_by_email_domain(domain) do
    pattern = "%@#{domain}"
    Repo.one(from l in Lead, where: like(l.email, ^pattern), limit: 1)
  end

  defp maybe_merge_field(map, existing, new_attrs, field) do
    new_val = Map.get(new_attrs, field)
    old_val = Map.get(existing, field)

    if new_val && (is_nil(old_val) || old_val == "") do
      Map.put(map, field, new_val)
    else
      map
    end
  end

  defp maybe_filter_job(query, %{"job_id" => job_id}) do
    where(query, [l], l.job_id == ^parse_int_val(job_id))
  end

  defp maybe_filter_job(query, _), do: query

  defp maybe_filter_platform(query, %{"platform" => platform}) when is_binary(platform) do
    where(query, [l], l.platform == ^platform)
  end

  defp maybe_filter_platform(query, _), do: query

  defp maybe_filter_status(query, %{"status" => status}) when is_binary(status) do
    where(query, [l], l.status == ^status)
  end

  defp maybe_filter_status(query, _), do: query

  defp maybe_filter_min_confidence(query, %{"min_confidence" => min}) do
    min_val = parse_float(min)
    where(query, [l], l.confidence_score >= ^min_val)
  end

  defp maybe_filter_min_confidence(query, _), do: query

  defp maybe_search(query, %{"search" => search}) when is_binary(search) and search != "" do
    pattern = "%#{search}%"
    where(query, [l], like(l.email, ^pattern) or like(l.channel_name, ^pattern))
  end

  defp maybe_search(query, _), do: query

  defp apply_sort(query, %{"sort" => field, "order" => "asc"}) do
    order_by(query, [l], asc: ^safe_sort_field(field))
  end

  defp apply_sort(query, %{"sort" => field}) do
    order_by(query, [l], desc: ^safe_sort_field(field))
  end

  defp apply_sort(query, _), do: order_by(query, [l], desc: :inserted_at)

  defp safe_sort_field("confidence_score"), do: :confidence_score
  defp safe_sort_field("subscriber_count"), do: :subscriber_count
  defp safe_sort_field("email"), do: :email
  defp safe_sort_field("platform"), do: :platform
  defp safe_sort_field(_), do: :inserted_at

  defp parse_int(params, key, default) do
    case Map.get(params, key) do
      nil -> default
      val when is_integer(val) -> val
      val when is_binary(val) -> String.to_integer(val)
    end
  rescue
    _ -> default
  end

  defp parse_int_val(val) when is_integer(val), do: val
  defp parse_int_val(val) when is_binary(val), do: String.to_integer(val)

  defp parse_float(val) when is_float(val), do: val
  defp parse_float(val) when is_integer(val), do: val / 1
  defp parse_float(val) when is_binary(val), do: String.to_float(val)
  defp parse_float(_), do: 0.0

  def delete_lead(%Lead{} = lead) do
    Repo.delete(lead)
  end
end

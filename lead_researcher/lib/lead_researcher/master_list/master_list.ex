defmodule LeadResearcher.MasterList do
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.MasterList.MasterListEntry
  alias LeadResearcher.Leads
  alias LeadResearcher.Leads.Lead

  def list_entries(params \\ %{}) do
    MasterListEntry
    |> join(:inner, [e], l in Lead, on: e.lead_id == l.id)
    |> maybe_search(params)
    |> order_by([e, l], desc: e.inserted_at)
    |> limit(^parse_int(params, "limit", 100))
    |> offset(^parse_int(params, "offset", 0))
    |> preload(:lead)
    |> Repo.all()
  end

  def count_entries do
    Repo.aggregate(MasterListEntry, :count)
  end

  def add_from_job(job_id, lead_ids \\ nil) do
    leads =
      if lead_ids do
        Enum.map(lead_ids, &Leads.get_lead!/1)
      else
        Leads.list_leads(%{"job_id" => job_id, "limit" => 10_000})
      end

    existing_entries =
      MasterListEntry
      |> preload(:lead)
      |> Repo.all()

    existing_leads = Enum.map(existing_entries, & &1.lead)

    {added, duplicates} =
      Enum.reduce(leads, {[], []}, fn lead, {added_acc, dup_acc} ->
        case find_duplicate(lead, existing_leads) do
          nil ->
            case create_entry(%{lead_id: lead.id, job_id: job_id}) do
              {:ok, entry} -> {[entry | added_acc], dup_acc}
              _ -> {added_acc, dup_acc}
            end

          {existing_lead, reason} ->
            group_id = "dup-#{:crypto.strong_rand_bytes(6) |> Base.url_encode64(padding: false)}"

            {added_acc, [%{
              group_id: group_id,
              new_lead: lead,
              existing_lead: existing_lead,
              reason: reason
            } | dup_acc]}
        end
      end)

    {:ok, %{added: length(added), duplicates: Enum.reverse(duplicates)}}
  end

  def remove_entry(lead_id) do
    case Repo.get_by(MasterListEntry, lead_id: lead_id) do
      nil -> {:error, :not_found}
      entry -> Repo.delete(entry)
    end
  end

  def list_duplicate_groups do
    MasterListEntry
    |> where([e], e.duplicate_status == "pending")
    |> where([e], not is_nil(e.duplicate_group_id))
    |> preload(:lead)
    |> Repo.all()
    |> Enum.group_by(& &1.duplicate_group_id)
  end

  def resolve_duplicate(group_id, action, keep_lead_id) do
    entries =
      MasterListEntry
      |> where([e], e.duplicate_group_id == ^group_id)
      |> Repo.all()

    case action do
      "keep" ->
        Enum.each(entries, fn entry ->
          if entry.lead_id == keep_lead_id do
            entry |> Ecto.Changeset.change(%{duplicate_status: "resolved_keep", duplicate_group_id: nil}) |> Repo.update()
          else
            entry |> Ecto.Changeset.change(%{duplicate_status: "resolved_skip"}) |> Repo.update()
            Repo.delete(entry)
          end
        end)
        :ok

      "skip" ->
        Enum.each(entries, fn entry ->
          Repo.delete(entry)
        end)
        :ok

      _ ->
        {:error, :invalid_action}
    end
  end

  defp create_entry(attrs) do
    %MasterListEntry{}
    |> MasterListEntry.changeset(attrs)
    |> Repo.insert()
  end

  defp find_duplicate(lead, existing_leads) do
    cond do
      lead.email && Enum.find(existing_leads, &(&1.email == lead.email && &1.id != lead.id)) ->
        {Enum.find(existing_leads, &(&1.email == lead.email && &1.id != lead.id)), "동일한 이메일 주소"}

      lead.channel_url && Enum.find(existing_leads, &(&1.channel_url == lead.channel_url && &1.id != lead.id)) ->
        {Enum.find(existing_leads, &(&1.channel_url == lead.channel_url && &1.id != lead.id)), "동일한 채널 URL"}

      true ->
        nil
    end
  end

  defp maybe_search(query, %{"search" => search}) when is_binary(search) and search != "" do
    pattern = "%#{search}%"
    where(query, [_e, l], like(l.email, ^pattern) or like(l.channel_name, ^pattern))
  end
  defp maybe_search(query, _), do: query

  defp parse_int(params, key, default) do
    case Map.get(params, key) do
      nil -> default
      val when is_integer(val) -> val
      val when is_binary(val) -> String.to_integer(val)
      _ -> default
    end
  rescue
    _ -> default
  end
end

defmodule LeadResearcherWeb.MasterListController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.MasterList

  def index(conn, params) do
    entries = MasterList.list_entries(params)
    total = MasterList.count_entries()

    leads = Enum.map(entries, fn entry ->
      lead = entry.lead
      %{
        id: lead.id,
        email: lead.email,
        email_verified: lead.email_verified || false,
        platform: lead.platform,
        channel_name: lead.channel_name,
        channel_url: lead.channel_url,
        evidence_link: lead.evidence_link,
        subscriber_count: lead.subscriber_count,
        status: lead.status,
        notes: lead.notes || entry.notes,
        job_id: entry.job_id,
        inserted_at: entry.inserted_at
      }
    end)

    json(conn, %{data: leads, total: total})
  end

  def add(conn, %{"job_id" => job_id} = params) do
    lead_ids = Map.get(params, "lead_ids")

    case MasterList.add_from_job(job_id, lead_ids) do
      {:ok, result} ->
        duplicates = Enum.map(result.duplicates, fn dup ->
          %{
            group_id: dup.group_id,
            reason: dup.reason,
            new_lead: lead_data(dup.new_lead),
            existing_lead: lead_data(dup.existing_lead)
          }
        end)

        json(conn, %{
          added: result.added,
          duplicates: duplicates
        })

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  def remove(conn, %{"lead_id" => lead_id}) do
    case MasterList.remove_entry(String.to_integer(lead_id)) do
      {:ok, _} -> json(conn, %{ok: true})
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})
    end
  end

  def duplicates(conn, _params) do
    groups = MasterList.list_duplicate_groups()

    data = Enum.map(groups, fn {group_id, entries} ->
      %{
        group_id: group_id,
        leads: Enum.map(entries, fn entry -> lead_data(entry.lead) end)
      }
    end)

    json(conn, %{data: data})
  end

  def resolve_duplicate(conn, %{"group_id" => group_id, "action" => action} = params) do
    keep_lead_id = Map.get(params, "keep_lead_id")

    case MasterList.resolve_duplicate(group_id, action, keep_lead_id) do
      :ok -> json(conn, %{ok: true})
      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp lead_data(lead) do
    %{
      id: lead.id,
      email: lead.email,
      email_verified: Map.get(lead, :email_verified, false),
      platform: lead.platform,
      channel_name: lead.channel_name,
      channel_url: lead.channel_url,
      subscriber_count: lead.subscriber_count,
      notes: lead.notes
    }
  end
end

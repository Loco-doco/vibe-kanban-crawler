defmodule LeadResearcherWeb.LeadController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.Leads
  alias LeadResearcher.EditHistories
  alias LeadResearcher.Export.CsvExporter

  def index(conn, params) do
    leads = Leads.list_leads(params)
    render(conn, :index, leads: leads)
  end

  def show(conn, %{"id" => id}) do
    lead = Leads.get_lead!(id)
    render(conn, :show, lead: lead)
  end

  def update(conn, %{"id" => id, "lead" => lead_params}) do
    lead = Leads.get_lead!(id)

    # Use atom keys for update_lead_with_history
    attrs =
      lead_params
      |> Enum.map(fn {k, v} -> {String.to_existing_atom(k), v} end)
      |> Map.new()

    case Leads.update_lead_with_history(lead, attrs) do
      {:ok, updated_lead} ->
        render(conn, :show, lead: updated_lead)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  rescue
    ArgumentError ->
      conn
      |> put_status(:bad_request)
      |> json(%{error: "잘못된 필드가 포함되어 있습니다"})
  end

  def bulk_review(conn, %{"lead_ids" => lead_ids, "review_status" => review_status})
      when is_list(lead_ids) do
    {count, _} = Leads.bulk_update_review(lead_ids, review_status)
    json(conn, %{updated: count})
  end

  @doc "Approve leads and queue for master review with duplicate checking"
  def approve_and_queue(conn, %{"lead_ids" => lead_ids}) when is_list(lead_ids) do
    case LeadResearcher.Handoff.approve_and_queue(lead_ids) do
      {:ok, result} ->
        json(conn, %{
          ready: result.ready,
          conflicts: result.conflicts,
          conflict_leads:
            Enum.map(result.conflict_leads, fn cl ->
              %{
                lead_id: cl.lead_id,
                conflicts:
                  Enum.map(cl.conflicts, fn c ->
                    %{rule: c.rule, existing_lead_id: c.existing_lead_id, value: c.value}
                  end)
              }
            end)
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def edit_history(conn, %{"id" => id}) do
    history = EditHistories.list_for_lead(String.to_integer(id))

    entries =
      Enum.map(history, fn h ->
        %{
          field_name: h.field_name,
          old_value: h.old_value,
          new_value: h.new_value,
          edited_by: h.edited_by,
          edited_at: h.edited_at
        }
      end)

    json(conn, %{data: entries})
  end

  def delete(conn, %{"id" => id}) do
    lead = Leads.get_lead!(id)

    case Leads.delete_lead(lead) do
      {:ok, _} ->
        send_resp(conn, :no_content, "")

      {:error, _} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "삭제 실패"})
    end
  end

  def export_csv(conn, params) do
    leads = Leads.list_leads(Map.put(params, "limit", 10_000))
    csv = CsvExporter.to_csv(leads)

    conn
    |> put_resp_content_type("text/csv")
    |> put_resp_header("content-disposition", "attachment; filename=\"leads_export.csv\"")
    |> send_resp(200, csv)
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end

defmodule LeadResearcherWeb.LeadController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.Leads
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

    case Leads.update_lead(lead, lead_params) do
      {:ok, lead} ->
        render(conn, :show, lead: lead)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
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

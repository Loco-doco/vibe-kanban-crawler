defmodule LeadResearcherWeb.ExportController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.Jobs
  alias LeadResearcher.Leads
  alias LeadResearcher.Export.JsonExporter

  def export_job(conn, %{"id" => id}) do
    job = Jobs.get_job!(id)
    leads = Leads.list_leads(%{"job_id" => to_string(id), "limit" => "10000"})
    export = JsonExporter.build_job_export(job, leads)

    conn
    |> put_resp_content_type("application/json")
    |> put_resp_header(
      "content-disposition",
      "attachment; filename=\"job_#{id}_export.json\""
    )
    |> json(export)
  end

  def export_leads(conn, %{"job_id" => job_id} = params) do
    job = Jobs.get_job!(job_id)

    leads =
      params
      |> Map.put("limit", Map.get(params, "limit", "10000"))
      |> Leads.list_leads()
      |> LeadResearcher.Repo.preload(:enrichment)

    export = JsonExporter.build_leads_export(leads, job)

    conn
    |> put_resp_content_type("application/json")
    |> put_resp_header(
      "content-disposition",
      "attachment; filename=\"leads_job_#{job_id}_export.json\""
    )
    |> json(export)
  end

  def export_leads(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "job_id 파라미터가 필요합니다"})
  end
end

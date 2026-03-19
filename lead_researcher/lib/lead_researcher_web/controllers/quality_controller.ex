defmodule LeadResearcherWeb.QualityController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.{Leads, Quality}

  def show(conn, %{"id" => job_id}) do
    leads = Leads.list_leads(%{"job_id" => job_id, "limit" => "10000"})
    quality = Quality.compute_job_quality(leads)
    json(conn, %{data: quality})
  end
end

defmodule LeadResearcherWeb.HealthController do
  use LeadResearcherWeb, :controller

  def index(conn, _params) do
    json(conn, %{status: "ok"})
  end
end

defmodule LeadResearcherWeb.Router do
  use LeadResearcherWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", LeadResearcherWeb do
    pipe_through :api

    get "/health", HealthController, :index

    resources "/jobs", JobController, only: [:index, :create, :show]
    post "/jobs/:id/cancel", JobController, :cancel

    get "/leads/export/csv", LeadController, :export_csv
    resources "/leads", LeadController, only: [:index, :show, :update, :delete]

    get "/master-list", MasterListController, :index
    post "/master-list/add", MasterListController, :add
    delete "/master-list/:lead_id", MasterListController, :remove
    get "/master-list/duplicates", MasterListController, :duplicates
    post "/master-list/duplicates/resolve", MasterListController, :resolve_duplicate
  end
end

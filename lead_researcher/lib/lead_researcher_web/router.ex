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
    resources "/leads", LeadController, only: [:index, :show, :update]
  end
end

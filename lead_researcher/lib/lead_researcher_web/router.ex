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
    post "/jobs/:id/supplement", JobController, :supplement
    post "/jobs/:id/enrich-subscribers", JobController, :enrich_subscribers
    post "/jobs/:id/enrich-channels", JobController, :enrich_channels
    get "/enrichment-runs/:id", JobController, :enrichment_run_status
    post "/parse-prompt", JobController, :parse_prompt

    get "/leads/export/csv", LeadController, :export_csv
    resources "/leads", LeadController, only: [:index, :show, :update, :delete]
    post "/leads/bulk-review", LeadController, :bulk_review
    get "/leads/:id/edit-history", LeadController, :edit_history

    # Quality metrics
    get "/quality/jobs/:id", QualityController, :show

    # Export / Import for operator assist
    get "/export/jobs/:id", ExportController, :export_job
    get "/export/leads", ExportController, :export_leads
    post "/import/enrichments", ImportController, :import_enrichments
    post "/import/keywords", ImportController, :import_keywords

    get "/master-list", MasterListController, :index
    post "/master-list/add", MasterListController, :add
    delete "/master-list/:lead_id", MasterListController, :remove
    get "/master-list/duplicates", MasterListController, :duplicates
    post "/master-list/duplicates/resolve", MasterListController, :resolve_duplicate
  end
end

defmodule LeadResearcher.Repo do
  use Ecto.Repo,
    otp_app: :lead_researcher,
    adapter: Ecto.Adapters.SQLite3
end

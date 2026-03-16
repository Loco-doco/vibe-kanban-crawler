defmodule LeadResearcher.Repo.Migrations.CreateJobs do
  use Ecto.Migration

  def change do
    create table(:jobs) do
      add :targets, :text, null: false
      add :status, :string, default: "pending", null: false
      add :max_retries, :integer, default: 3
      add :delay_ms, :integer, default: 2000
      add :max_depth, :integer, default: 3
      add :total_leads_found, :integer, default: 0
      add :error_message, :text
      add :started_at, :utc_datetime
      add :completed_at, :utc_datetime

      timestamps()
    end

    create index(:jobs, [:status])
  end
end

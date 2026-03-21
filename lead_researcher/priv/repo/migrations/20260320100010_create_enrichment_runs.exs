defmodule LeadResearcher.Repo.Migrations.CreateEnrichmentRuns do
  use Ecto.Migration

  def change do
    create table(:enrichment_runs) do
      add :job_id, references(:jobs, on_delete: :delete_all), null: false
      add :run_type, :string, null: false  # "subscribers" | "channels"
      add :status, :string, null: false, default: "running"
      add :total, :integer, default: 0
      add :processed, :integer, default: 0
      add :updated, :integer, default: 0
      add :failed, :integer, default: 0

      timestamps()
    end

    create index(:enrichment_runs, [:job_id])
  end
end

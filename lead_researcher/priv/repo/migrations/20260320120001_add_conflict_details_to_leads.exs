defmodule LeadResearcher.Repo.Migrations.AddConflictDetailsToLeads do
  use Ecto.Migration

  def change do
    alter table(:leads) do
      add :conflict_details, :text
    end

    create index(:leads, [:master_sync_status])
  end
end

defmodule LeadResearcher.Repo.Migrations.AddPriorityScoreToLeads do
  use Ecto.Migration

  def change do
    alter table(:leads) do
      add :priority_score, :integer, default: 0
    end

    create index(:leads, [:priority_score])
    create index(:leads, [:job_id, :priority_score])
  end
end

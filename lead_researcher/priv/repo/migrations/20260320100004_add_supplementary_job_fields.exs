defmodule LeadResearcher.Repo.Migrations.AddSupplementaryJobFields do
  use Ecto.Migration

  def change do
    alter table(:jobs) do
      add :parent_job_id, references(:jobs, on_delete: :nilify_all)
      add :supplementary_type, :string
    end

    create index(:jobs, [:parent_job_id])
  end
end

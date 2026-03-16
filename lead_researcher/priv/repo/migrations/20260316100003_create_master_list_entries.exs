defmodule LeadResearcher.Repo.Migrations.CreateMasterListEntries do
  use Ecto.Migration

  def change do
    create table(:master_list_entries) do
      add :lead_id, references(:leads, on_delete: :delete_all), null: false
      add :job_id, references(:jobs, on_delete: :nilify_all)
      add :duplicate_group_id, :string
      add :duplicate_status, :string, default: "none"
      add :notes, :text

      timestamps()
    end

    create unique_index(:master_list_entries, [:lead_id])
    create index(:master_list_entries, [:duplicate_group_id])
  end
end

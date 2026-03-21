defmodule LeadResearcher.Repo.Migrations.CreateLeadEditHistories do
  use Ecto.Migration

  def change do
    create table(:lead_edit_histories) do
      add :lead_id, references(:leads, on_delete: :delete_all), null: false
      add :field_name, :string, null: false
      add :old_value, :text
      add :new_value, :text
      add :edited_by, :string, default: "user"
      add :edited_at, :utc_datetime, null: false
    end

    create index(:lead_edit_histories, [:lead_id])
    create index(:lead_edit_histories, [:edited_at])
  end
end

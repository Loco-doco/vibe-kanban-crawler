defmodule LeadResearcher.Repo.Migrations.CreateJobKeywordSuggestions do
  use Ecto.Migration

  def change do
    create table(:job_keyword_suggestions) do
      add :job_id, references(:jobs, on_delete: :delete_all), null: false
      add :suggested_keywords, :text, null: false
      add :operator_id, :string
      add :notes, :text
      add :applied, :boolean, default: false

      timestamps()
    end

    create index(:job_keyword_suggestions, [:job_id])
  end
end

defmodule LeadResearcher.Repo.Migrations.CreateLeadEnrichments do
  use Ecto.Migration

  def change do
    create table(:lead_enrichments) do
      add :lead_id, references(:leads, on_delete: :delete_all), null: false
      add :source, :string, null: false, default: "operator"
      add :operator_id, :string

      add :business_summary, :text
      add :descriptor_keywords, :text
      add :content_topics, :text
      add :trend_summary, :text
      add :suggested_email, :string
      add :operator_notes, :text

      timestamps()
    end

    create unique_index(:lead_enrichments, [:lead_id])
  end
end

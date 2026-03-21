defmodule LeadResearcher.Repo.Migrations.AddEvidenceToEnrichments do
  use Ecto.Migration

  def change do
    alter table(:lead_enrichments) do
      add :evidence_url, :string
      add :extraction_method, :string
      add :evidence_fields, :text
      add :extracted_at, :utc_datetime
      add :coverage_score, :float
    end
  end
end

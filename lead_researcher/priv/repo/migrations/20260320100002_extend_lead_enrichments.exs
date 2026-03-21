defmodule LeadResearcher.Repo.Migrations.ExtendLeadEnrichments do
  use Ecto.Migration

  def change do
    alter table(:lead_enrichments) do
      add :profile_summary, :text
      add :recent_activity_summary, :text
      add :business_type, :string
      add :secondary_platforms, :text
      add :monetization_signals, :text
      add :contact_channels, :text
      add :enrichment_confidence, :float
    end
  end
end

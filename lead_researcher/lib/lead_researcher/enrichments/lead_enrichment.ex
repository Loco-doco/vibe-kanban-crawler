defmodule LeadResearcher.Enrichments.LeadEnrichment do
  use Ecto.Schema
  import Ecto.Changeset

  schema "lead_enrichments" do
    belongs_to :lead, LeadResearcher.Leads.Lead

    field :source, :string, default: "operator"
    field :operator_id, :string

    # Existing fields
    field :business_summary, :string
    field :descriptor_keywords, :string
    field :content_topics, :string
    field :trend_summary, :string
    field :suggested_email, :string
    field :operator_notes, :string

    # Phase 5 extensions
    field :profile_summary, :string
    field :recent_activity_summary, :string
    field :business_type, :string
    field :secondary_platforms, :string
    field :monetization_signals, :string
    field :contact_channels, :string
    field :enrichment_confidence, :float

    timestamps()
  end

  @allowed_fields [
    :lead_id, :source, :operator_id,
    :business_summary, :descriptor_keywords, :content_topics,
    :trend_summary, :suggested_email, :operator_notes,
    :profile_summary, :recent_activity_summary, :business_type,
    :secondary_platforms, :monetization_signals, :contact_channels,
    :enrichment_confidence
  ]

  def changeset(enrichment, attrs) do
    enrichment
    |> cast(attrs, @allowed_fields)
    |> validate_required([:lead_id, :source])
    |> validate_inclusion(:source, ~w(operator system))
    |> unique_constraint(:lead_id)
    |> foreign_key_constraint(:lead_id)
  end
end

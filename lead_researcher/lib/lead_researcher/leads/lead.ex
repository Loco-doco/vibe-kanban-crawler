defmodule LeadResearcher.Leads.Lead do
  use Ecto.Schema
  import Ecto.Changeset

  schema "leads" do
    # Raw crawler data (read-only evidence)
    field :email, :string
    field :platform, :string
    field :channel_name, :string
    field :channel_url, :string
    field :evidence_link, :string
    field :confidence_score, :float, default: 0.0
    field :subscriber_count, :integer
    field :status, :string, default: "scraped"
    field :last_contacted_at, :utc_datetime
    field :notes, :string
    field :raw_data, :string
    field :email_verified, :boolean, default: false
    field :source_platform, :string
    field :source_type, :string
    field :source_url, :string
    field :discovery_keyword, :string
    field :discovery_keywords, :string
    field :normalized_tags, :string
    field :review_status, :string, default: "pending"
    field :master_sync_status, :string, default: "not_synced"

    # Email status
    field :email_status, :string, default: "missing"

    # Audience metrics
    field :audience_metric_type, :string, default: "unknown"
    field :audience_tier, :string
    field :audience_source, :string, default: "crawler"
    field :audience_failure_reason, :string

    # User overrides (never overwrites raw fields above)
    field :display_name, :string
    field :contact_email, :string
    field :audience_size_override, :integer
    field :audience_tier_override, :string

    # Contact readiness (UX-1)
    field :contact_readiness, :string, default: "needs_verification"
    field :suspect_reason, :string

    # Enrichment tracking
    field :enrichment_status, :string, default: "not_started"

    # Priority ranking (Phase 6)
    field :priority_score, :integer, default: 0

    belongs_to :job, LeadResearcher.Jobs.Job
    has_one :enrichment, LeadResearcher.Enrichments.LeadEnrichment

    timestamps()
  end

  @cast_fields [
    :email, :platform, :channel_name, :channel_url, :evidence_link,
    :confidence_score, :subscriber_count, :status, :last_contacted_at,
    :notes, :raw_data, :job_id, :email_verified,
    :source_platform, :source_type, :source_url, :discovery_keyword, :discovery_keywords, :normalized_tags,
    :review_status, :master_sync_status,
    :email_status, :audience_metric_type, :audience_tier, :audience_source, :audience_failure_reason,
    :display_name, :contact_email, :audience_size_override, :audience_tier_override,
    :contact_readiness, :suspect_reason,
    :enrichment_status,
    :priority_score
  ]

  def changeset(lead, attrs) do
    lead
    |> cast(attrs, @cast_fields)
    |> validate_required([:evidence_link, :job_id])
    |> validate_inclusion(:status, ~w(scraped verified contacted replied bounced manual_review))
    |> validate_inclusion(:platform, ~w(youtube instagram class101 liveklass web unknown))
    |> validate_inclusion(:review_status, ~w(pending auto_approved auto_rejected needs_review approved rejected held))
    |> validate_inclusion(:master_sync_status, ~w(not_synced ready conflict synced))
    |> validate_inclusion(:email_status, ~w(missing unverified valid_syntax invalid_syntax user_corrected))
    |> validate_inclusion(:audience_metric_type, ~w(subscriber follower member unknown))
    |> validate_inclusion(:enrichment_status, ~w(not_started completed low_confidence failed))
    |> validate_inclusion(:contact_readiness, ~w(contactable no_email platform_suspect needs_verification user_confirmed))
    |> foreign_key_constraint(:job_id)
  end

  @doc "Compute audience tier from raw subscriber/follower count"
  def compute_audience_tier(nil), do: nil
  def compute_audience_tier(count) when count < 1_000, do: "nano"
  def compute_audience_tier(count) when count < 10_000, do: "micro"
  def compute_audience_tier(count) when count < 100_000, do: "mid"
  def compute_audience_tier(count) when count < 1_000_000, do: "macro"
  def compute_audience_tier(_), do: "mega"
end

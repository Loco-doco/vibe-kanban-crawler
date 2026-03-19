defmodule LeadResearcher.Leads.Lead do
  use Ecto.Schema
  import Ecto.Changeset

  schema "leads" do
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
    field :review_status, :string, default: "pending"
    field :master_sync_status, :string, default: "not_synced"

    belongs_to :job, LeadResearcher.Jobs.Job
    has_one :enrichment, LeadResearcher.Enrichments.LeadEnrichment

    timestamps()
  end

  def changeset(lead, attrs) do
    lead
    |> cast(attrs, [
      :email, :platform, :channel_name, :channel_url, :evidence_link,
      :confidence_score, :subscriber_count, :status, :last_contacted_at,
      :notes, :raw_data, :job_id, :email_verified,
      :source_platform, :source_type, :source_url, :discovery_keyword,
      :review_status, :master_sync_status
    ])
    |> validate_required([:evidence_link, :job_id])
    |> validate_inclusion(:status, ~w(scraped verified contacted replied bounced manual_review))
    |> validate_inclusion(:platform, ~w(youtube instagram class101 liveklass web unknown))
    |> validate_inclusion(:review_status, ~w(pending approved rejected held))
    |> validate_inclusion(:master_sync_status, ~w(not_synced ready conflict synced))
    |> foreign_key_constraint(:job_id)
  end
end

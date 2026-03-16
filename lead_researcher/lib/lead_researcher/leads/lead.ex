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

    belongs_to :job, LeadResearcher.Jobs.Job

    timestamps()
  end

  def changeset(lead, attrs) do
    lead
    |> cast(attrs, [
      :email, :platform, :channel_name, :channel_url, :evidence_link,
      :confidence_score, :subscriber_count, :status, :last_contacted_at,
      :notes, :raw_data, :job_id
    ])
    |> validate_required([:evidence_link, :job_id])
    |> validate_inclusion(:status, ~w(scraped verified contacted replied bounced manual_review))
    |> validate_inclusion(:platform, ~w(youtube instagram web unknown))
    |> foreign_key_constraint(:job_id)
  end
end

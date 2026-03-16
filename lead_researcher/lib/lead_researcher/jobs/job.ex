defmodule LeadResearcher.Jobs.Job do
  use Ecto.Schema
  import Ecto.Changeset

  schema "jobs" do
    field :targets, :string
    field :status, :string, default: "pending"
    field :max_retries, :integer, default: 3
    field :delay_ms, :integer, default: 2000
    field :max_depth, :integer, default: 3
    field :total_leads_found, :integer, default: 0
    field :error_message, :string
    field :started_at, :utc_datetime
    field :completed_at, :utc_datetime

    field :platform, :string
    field :category_tags, :string
    field :target_count, :integer, default: 50
    field :subscriber_min, :integer
    field :subscriber_max, :integer
    field :extra_conditions, :string
    field :label, :string

    has_many :leads, LeadResearcher.Leads.Lead

    timestamps()
  end

  def changeset(job, attrs) do
    job
    |> cast(attrs, [
      :targets, :status, :max_retries, :delay_ms, :max_depth,
      :total_leads_found, :error_message, :started_at, :completed_at,
      :platform, :category_tags, :target_count, :subscriber_min,
      :subscriber_max, :extra_conditions, :label
    ])
    |> validate_required([:targets])
    |> validate_inclusion(:status, ~w(pending running completed failed cancelled))
    |> validate_number(:max_retries, greater_than_or_equal_to: 0, less_than_or_equal_to: 10)
    |> validate_number(:delay_ms, greater_than_or_equal_to: 0)
    |> validate_number(:max_depth, greater_than_or_equal_to: 1, less_than_or_equal_to: 5)
    |> validate_number(:target_count, greater_than_or_equal_to: 1)
  end
end

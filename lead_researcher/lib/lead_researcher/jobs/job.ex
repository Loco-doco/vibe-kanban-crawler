defmodule LeadResearcher.Jobs.Job do
  use Ecto.Schema
  import Ecto.Changeset

  schema "jobs" do
    field :targets, :string
    field :status, :string, default: "queued"
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
    field :mode, :string, default: "url"
    field :keywords, :string
    field :termination_reason, :string
    field :crawl_stats, :string

    # Supplementary search linkage
    field :parent_job_id, :integer
    field :supplementary_type, :string

    has_many :leads, LeadResearcher.Leads.Lead
    has_many :supplementary_jobs, LeadResearcher.Jobs.Job, foreign_key: :parent_job_id
    belongs_to :parent_job, LeadResearcher.Jobs.Job, foreign_key: :parent_job_id, define_field: false

    timestamps()
  end

  def changeset(job, attrs) do
    job
    |> cast(attrs, [
      :targets, :status, :max_retries, :delay_ms, :max_depth,
      :total_leads_found, :error_message, :started_at, :completed_at,
      :platform, :category_tags, :target_count, :subscriber_min,
      :subscriber_max, :extra_conditions, :label, :mode, :keywords,
      :termination_reason, :crawl_stats,
      :parent_job_id, :supplementary_type
    ])
    |> validate_required([:targets])
    |> validate_inclusion(:status, ~w(draft queued running partial_results completed completed_low_yield failed cancelled))
    |> validate_inclusion(:mode, ~w(url discovery))
    |> validate_number(:max_retries, greater_than_or_equal_to: 0, less_than_or_equal_to: 10)
    |> validate_number(:delay_ms, greater_than_or_equal_to: 0)
    |> validate_number(:max_depth, greater_than_or_equal_to: 1, less_than_or_equal_to: 5)
    |> validate_number(:target_count, greater_than_or_equal_to: 1)
    |> validate_keywords_for_discovery()
  end

  defp validate_keywords_for_discovery(changeset) do
    case get_field(changeset, :mode) do
      "discovery" ->
        keywords = get_field(changeset, :keywords)

        if is_nil(keywords) or keywords == "" or keywords == "[]" do
          add_error(changeset, :keywords, "검색 키워드는 필수입니다")
        else
          changeset
        end

      _ ->
        changeset
    end
  end
end

defmodule LeadResearcher.Enrichments.JobKeywordSuggestion do
  use Ecto.Schema
  import Ecto.Changeset

  schema "job_keyword_suggestions" do
    belongs_to :job, LeadResearcher.Jobs.Job

    field :suggested_keywords, :string
    field :operator_id, :string
    field :notes, :string
    field :applied, :boolean, default: false

    timestamps()
  end

  def changeset(suggestion, attrs) do
    suggestion
    |> cast(attrs, [:job_id, :suggested_keywords, :operator_id, :notes, :applied])
    |> validate_required([:job_id, :suggested_keywords])
    |> foreign_key_constraint(:job_id)
  end
end

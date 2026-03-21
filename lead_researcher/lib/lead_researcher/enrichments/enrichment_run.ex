defmodule LeadResearcher.Enrichments.EnrichmentRun do
  use Ecto.Schema
  import Ecto.Changeset

  schema "enrichment_runs" do
    field :run_type, :string
    field :status, :string, default: "running"
    field :total, :integer, default: 0
    field :processed, :integer, default: 0
    field :updated, :integer, default: 0
    field :failed, :integer, default: 0

    belongs_to :job, LeadResearcher.Jobs.Job

    timestamps()
  end

  @cast_fields [:job_id, :run_type, :status, :total, :processed, :updated, :failed]

  def changeset(run, attrs) do
    run
    |> cast(attrs, @cast_fields)
    |> validate_required([:job_id, :run_type])
    |> validate_inclusion(:run_type, ~w(subscribers channels))
    |> validate_inclusion(:status, ~w(running completed failed))
    |> foreign_key_constraint(:job_id)
  end
end

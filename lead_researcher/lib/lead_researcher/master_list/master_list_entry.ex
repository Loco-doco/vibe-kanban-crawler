defmodule LeadResearcher.MasterList.MasterListEntry do
  use Ecto.Schema
  import Ecto.Changeset

  schema "master_list_entries" do
    belongs_to :lead, LeadResearcher.Leads.Lead
    belongs_to :job, LeadResearcher.Jobs.Job

    field :duplicate_group_id, :string
    field :duplicate_status, :string, default: "none"
    field :notes, :string

    timestamps()
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:lead_id, :job_id, :duplicate_group_id, :duplicate_status, :notes])
    |> validate_required([:lead_id])
    |> validate_inclusion(:duplicate_status, ~w(none pending resolved_keep resolved_skip))
    |> unique_constraint(:lead_id)
    |> foreign_key_constraint(:lead_id)
    |> foreign_key_constraint(:job_id)
  end
end

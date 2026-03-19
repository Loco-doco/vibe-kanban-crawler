defmodule LeadResearcher.EditHistories.LeadEditHistory do
  use Ecto.Schema
  import Ecto.Changeset

  schema "lead_edit_histories" do
    belongs_to :lead, LeadResearcher.Leads.Lead

    field :field_name, :string
    field :old_value, :string
    field :new_value, :string
    field :edited_by, :string, default: "user"
    field :edited_at, :utc_datetime
  end

  def changeset(history, attrs) do
    history
    |> cast(attrs, [:lead_id, :field_name, :old_value, :new_value, :edited_by, :edited_at])
    |> validate_required([:lead_id, :field_name, :edited_at])
    |> foreign_key_constraint(:lead_id)
  end
end

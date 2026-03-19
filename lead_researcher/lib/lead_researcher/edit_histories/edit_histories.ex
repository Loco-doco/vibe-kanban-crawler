defmodule LeadResearcher.EditHistories do
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.EditHistories.LeadEditHistory

  def list_for_lead(lead_id) do
    LeadEditHistory
    |> where([h], h.lead_id == ^lead_id)
    |> order_by([h], desc: :edited_at)
    |> Repo.all()
  end

  def log_change(lead_id, field_name, old_value, new_value, edited_by \\ "user") do
    %LeadEditHistory{}
    |> LeadEditHistory.changeset(%{
      lead_id: lead_id,
      field_name: field_name,
      old_value: to_string_or_nil(old_value),
      new_value: to_string_or_nil(new_value),
      edited_by: edited_by,
      edited_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Repo.insert()
  end

  def log_changes(lead_id, changes, edited_by \\ "user") do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Enum.each(changes, fn {field, {old_val, new_val}} ->
      %LeadEditHistory{}
      |> LeadEditHistory.changeset(%{
        lead_id: lead_id,
        field_name: to_string(field),
        old_value: to_string_or_nil(old_val),
        new_value: to_string_or_nil(new_val),
        edited_by: edited_by,
        edited_at: now
      })
      |> Repo.insert!()
    end)

    :ok
  end

  defp to_string_or_nil(nil), do: nil
  defp to_string_or_nil(val), do: to_string(val)
end

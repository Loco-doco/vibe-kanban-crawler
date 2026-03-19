defmodule LeadResearcher.Enrichments do
  @moduledoc """
  Context for lead enrichment data.
  Operator enrichment is stored separately from system-original lead data.
  """
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Enrichments.LeadEnrichment

  def get_enrichment_by_lead(lead_id) do
    Repo.get_by(LeadEnrichment, lead_id: lead_id)
  end

  def list_enrichments_for_leads(lead_ids) when is_list(lead_ids) do
    LeadEnrichment
    |> where([e], e.lead_id in ^lead_ids)
    |> Repo.all()
    |> Map.new(&{&1.lead_id, &1})
  end

  def upsert_enrichment(attrs) do
    lead_id =
      Map.get(attrs, :lead_id) ||
        Map.get(attrs, "lead_id")

    case Repo.get_by(LeadEnrichment, lead_id: lead_id) do
      nil ->
        %LeadEnrichment{}
        |> LeadEnrichment.changeset(attrs)
        |> Repo.insert()

      existing ->
        existing
        |> LeadEnrichment.changeset(attrs)
        |> Repo.update()
    end
  end

  def bulk_import(enrichments_list, operator_id \\ "claude_code") do
    results =
      Enum.reduce(enrichments_list, %{imported: 0, errors: []}, fn entry, acc ->
        lead_id = Map.get(entry, "lead_id") || Map.get(entry, :lead_id)

        case LeadResearcher.Repo.get(LeadResearcher.Leads.Lead, lead_id) do
          nil ->
            error = %{lead_id: lead_id, error: "lead not found"}
            %{acc | errors: [error | acc.errors]}

          _lead ->
            attrs =
              entry
              |> encode_json_fields()
              |> Map.put("operator_id", operator_id)
              |> Map.put("source", "operator")

            case upsert_enrichment(attrs) do
              {:ok, _} ->
                %{acc | imported: acc.imported + 1}

              {:error, changeset} ->
                error = %{lead_id: lead_id, error: format_changeset_error(changeset)}
                %{acc | errors: [error | acc.errors]}
            end
        end
      end)

    %{results | errors: Enum.reverse(results.errors)}
  end

  defp encode_json_fields(entry) do
    entry
    |> maybe_encode("descriptor_keywords")
    |> maybe_encode("content_topics")
  end

  defp maybe_encode(entry, field) do
    case Map.get(entry, field) do
      val when is_list(val) -> Map.put(entry, field, Jason.encode!(val))
      _ -> entry
    end
  end

  defp format_changeset_error(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
    |> Enum.map(fn {field, msgs} -> "#{field}: #{Enum.join(msgs, ", ")}" end)
    |> Enum.join("; ")
  end
end

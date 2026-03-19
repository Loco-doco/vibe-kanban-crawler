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

  @doc """
  Auto-enrich a lead from crawler enrichment data (system source).
  Upserts enrichment record with evidence, updates lead enrichment_status.
  """
  def auto_enrich(lead_id, enrichment_data) when is_map(enrichment_data) do
    evidence = enrichment_data["evidence"] || %{}
    evidence_confidence = evidence["evidence_confidence"]

    # Determine enrichment_status from confidence
    enrichment_status =
      cond do
        is_number(evidence_confidence) and evidence_confidence >= 0.6 -> "completed"
        is_number(evidence_confidence) and evidence_confidence >= 0.3 -> "low_confidence"
        true -> "failed"
      end

    attrs = %{
      lead_id: lead_id,
      source: "system",
      profile_summary: enrichment_data["profile_summary"],
      business_summary: enrichment_data["business_summary"],
      business_type: enrichment_data["business_type"],
      content_topics: encode_if_list(enrichment_data["content_topics"]),
      profile_tags: encode_if_list(enrichment_data["profile_tags"]),
      recent_activity_summary: enrichment_data["recent_activity_summary"],
      secondary_platforms: encode_if_list(enrichment_data["secondary_platforms"]),
      enrichment_confidence: evidence_confidence,
      evidence_url: evidence["source_url"],
      extraction_method: evidence["extraction_method"],
      evidence_fields: encode_if_map(evidence["fields"]),
      extracted_at: parse_datetime(evidence["extracted_at"]),
      coverage_score: evidence["coverage_score"]
    }

    case upsert_enrichment(attrs) do
      {:ok, enrichment} ->
        # Update lead's enrichment_status
        lead = Repo.get!(LeadResearcher.Leads.Lead, lead_id)
        lead
        |> LeadResearcher.Leads.Lead.changeset(%{enrichment_status: enrichment_status})
        |> Repo.update()

        {:ok, enrichment}

      error ->
        error
    end
  end

  defp encode_if_list(val) when is_list(val), do: Jason.encode!(val)
  defp encode_if_list(val) when is_binary(val), do: val
  defp encode_if_list(_), do: nil

  defp encode_if_map(val) when is_map(val), do: Jason.encode!(val)
  defp encode_if_map(val) when is_binary(val), do: val
  defp encode_if_map(_), do: nil

  defp parse_datetime(nil), do: nil
  defp parse_datetime(iso) when is_binary(iso) do
    case DateTime.from_iso8601(iso) do
      {:ok, dt, _} -> DateTime.truncate(dt, :second)
      _ -> nil
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

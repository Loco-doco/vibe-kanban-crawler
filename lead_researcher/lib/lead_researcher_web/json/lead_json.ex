defmodule LeadResearcherWeb.LeadJSON do
  alias LeadResearcher.Leads.Lead
  alias LeadResearcher.Enrichments.LeadEnrichment

  def index(%{leads: leads}), do: %{data: for(lead <- leads, do: data(lead))}
  def show(%{lead: lead}), do: %{data: data(lead)}

  defp data(%Lead{} = lead) do
    base = %{
      id: lead.id,
      email: lead.email,
      email_verified: lead.email_verified || false,
      platform: lead.platform,
      channel_name: lead.channel_name,
      channel_url: lead.channel_url,
      evidence_link: lead.evidence_link,
      confidence_score: lead.confidence_score,
      subscriber_count: lead.subscriber_count,
      status: lead.status,
      last_contacted_at: lead.last_contacted_at,
      notes: lead.notes,
      source_platform: lead.source_platform,
      source_type: lead.source_type,
      source_url: lead.source_url,
      discovery_keyword: lead.discovery_keyword,
      review_status: lead.review_status,
      master_sync_status: lead.master_sync_status,
      job_id: lead.job_id,
      inserted_at: lead.inserted_at
    }

    enrichment =
      case lead.enrichment do
        %LeadEnrichment{} = e ->
          %{
            business_summary: e.business_summary,
            descriptor_keywords: safe_decode_json(e.descriptor_keywords, []),
            content_topics: safe_decode_json(e.content_topics, []),
            trend_summary: e.trend_summary,
            suggested_email: e.suggested_email,
            operator_notes: e.operator_notes,
            source: e.source,
            operator_id: e.operator_id,
            enriched_at: e.updated_at
          }

        _ ->
          nil
      end

    Map.put(base, :enrichment, enrichment)
  end

  defp safe_decode_json(nil, default), do: default

  defp safe_decode_json(val, default) when is_binary(val) do
    case Jason.decode(val) do
      {:ok, result} -> result
      _ -> default
    end
  end

  defp safe_decode_json(_, default), do: default
end

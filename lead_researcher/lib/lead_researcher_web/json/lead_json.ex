defmodule LeadResearcherWeb.LeadJSON do
  alias LeadResearcher.Leads.Lead
  alias LeadResearcher.Enrichments.LeadEnrichment

  def index(%{leads: leads}), do: %{data: for(lead <- leads, do: data(lead))}
  def show(%{lead: lead}), do: %{data: data(lead)}

  defp data(%Lead{} = lead) do
    effective_audience_size = lead.audience_size_override || lead.subscriber_count
    effective_audience_tier = lead.audience_tier_override || lead.audience_tier

    base = %{
      id: lead.id,
      # Raw crawler fields (read-only evidence)
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
      discovery_keywords: safe_decode_json(lead.discovery_keywords, []),
      normalized_tags: safe_decode_json(lead.normalized_tags, []),
      review_status: lead.review_status,
      master_sync_status: lead.master_sync_status,
      job_id: lead.job_id,
      inserted_at: lead.inserted_at,
      updated_at: lead.updated_at,
      # Phase 5 fields
      email_status: lead.email_status || "missing",
      audience_metric_type: lead.audience_metric_type || "unknown",
      audience_tier: lead.audience_tier,
      audience_source: lead.audience_source || "crawler",
      display_name: lead.display_name,
      contact_email: lead.contact_email,
      audience_size_override: lead.audience_size_override,
      audience_tier_override: lead.audience_tier_override,
      enrichment_status: lead.enrichment_status || "not_started",
      contact_readiness: lead.contact_readiness || "needs_verification",
      suspect_reason: lead.suspect_reason,
      audience_failure_reason: lead.audience_failure_reason,
      # Computed effective values (user override > raw)
      effective_name: lead.display_name || lead.channel_name,
      effective_email: lead.contact_email || lead.email,
      effective_audience_size: effective_audience_size,
      effective_audience_tier: effective_audience_tier,
      effective_audience_label: format_audience_label(effective_audience_size, lead.audience_metric_type),
      audience_display_status: compute_audience_display_status(lead)
    }

    enrichment =
      case lead.enrichment do
        %LeadEnrichment{} = e ->
          %{
            business_summary: e.business_summary,
            business_type: e.business_type,
            descriptor_keywords: safe_decode_json(e.descriptor_keywords, []),
            content_topics: safe_decode_json(e.content_topics, []),
            trend_summary: e.trend_summary,
            profile_summary: e.profile_summary,
            recent_activity_summary: e.recent_activity_summary,
            secondary_platforms: safe_decode_json(e.secondary_platforms, []),
            monetization_signals: safe_decode_json(e.monetization_signals, []),
            contact_channels: safe_decode_json(e.contact_channels, []),
            enrichment_confidence: e.enrichment_confidence,
            profile_tags: safe_decode_json(e.profile_tags, []),
            suggested_email: e.suggested_email,
            operator_notes: e.operator_notes,
            source: e.source,
            operator_id: e.operator_id,
            enriched_at: e.updated_at,
            # Evidence metadata (5B-4)
            evidence_url: e.evidence_url,
            extraction_method: e.extraction_method,
            evidence_fields: safe_decode_json(e.evidence_fields, nil),
            extracted_at: e.extracted_at,
            coverage_score: e.coverage_score
          }

        _ ->
          nil
      end

    Map.put(base, :enrichment, enrichment)
  end

  defp format_audience_label(nil, _type), do: nil

  defp format_audience_label(count, type) do
    metric = case type do
      "subscriber" -> "구독자"
      "follower" -> "팔로워"
      "member" -> "멤버"
      _ -> ""
    end

    formatted =
      cond do
        count >= 1_000_000 -> "#{format_number(count / 1_000_000)}백만"
        count >= 10_000 -> "#{format_number(count / 10_000)}만"
        count >= 1_000 -> "#{format_number(count / 1_000)}천"
        true -> "#{count}"
      end

    if metric == "", do: formatted, else: "#{formatted} #{metric}"
  end

  # not_collected: platform supports audience but no data
  # not_applicable: platform doesn't have audience metrics
  # collected: we have data
  defp compute_audience_display_status(lead) do
    cond do
      not is_nil(lead.audience_size_override) -> "collected"
      not is_nil(lead.subscriber_count) -> "collected"
      lead.platform in ["youtube", "instagram"] -> "not_collected"
      true -> "not_applicable"
    end
  end

  # Format number: remove trailing .0 (e.g., 5.0 → "5", 1.2 → "1.2")
  defp format_number(n) do
    rounded = Float.round(n / 1, 1)
    if rounded == Float.round(rounded, 0) do
      rounded |> round() |> Integer.to_string()
    else
      Float.to_string(rounded)
    end
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

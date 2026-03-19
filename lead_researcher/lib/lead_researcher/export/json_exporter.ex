defmodule LeadResearcher.Export.JsonExporter do
  @moduledoc """
  Builds JSON export structures for operator-assist workflows.
  """

  def build_job_export(job, leads) do
    %{
      export_version: "1.0",
      exported_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      job: %{
        job_id: job.id,
        label: job.label,
        status: job.status,
        termination_reason: job.termination_reason,
        keywords: safe_decode_json(job.keywords, []),
        category_tags: safe_decode_json(job.category_tags, []),
        subscriber_min: job.subscriber_min,
        subscriber_max: job.subscriber_max,
        extra_conditions: job.extra_conditions,
        target_count: job.target_count,
        crawl_stats: safe_decode_json(job.crawl_stats, nil),
        created_at: job.inserted_at,
        completed_at: job.completed_at
      },
      quality_summary: compute_quality_summary(leads, job)
    }
  end

  def build_leads_export(leads, job) do
    %{
      export_version: "1.0",
      exported_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      job_context: %{
        job_id: job.id,
        keywords: safe_decode_json(job.keywords, []),
        category_tags: safe_decode_json(job.category_tags, []),
        extra_conditions: job.extra_conditions
      },
      leads: Enum.map(leads, &lead_export_data/1)
    }
  end

  def compute_quality_summary(leads, job) do
    total = length(leads)
    with_email = Enum.count(leads, &(not is_nil(&1.email) and &1.email != ""))

    avg_confidence =
      if total > 0 do
        leads
        |> Enum.map(& &1.confidence_score || 0.0)
        |> Enum.sum()
        |> Kernel./(total)
        |> Float.round(2)
      else
        0.0
      end

    target = job.target_count || 0
    target_achieved_pct = if target > 0, do: Float.round(with_email / target * 100, 1), else: 0.0

    %{
      total_leads: total,
      leads_with_email: with_email,
      email_coverage_pct: if(total > 0, do: Float.round(with_email / total * 100, 1), else: 0.0),
      avg_confidence: avg_confidence,
      target_count: target,
      target_achieved_pct: target_achieved_pct
    }
  end

  defp lead_export_data(lead) do
    enrichment =
      case lead do
        %{enrichment: %{id: _} = e} ->
          %{
            business_summary: e.business_summary,
            descriptor_keywords: safe_decode_json(e.descriptor_keywords, []),
            content_topics: safe_decode_json(e.content_topics, []),
            trend_summary: e.trend_summary,
            suggested_email: e.suggested_email,
            operator_notes: e.operator_notes
          }

        _ ->
          nil
      end

    %{
      lead_id: lead.id,
      channel_name: lead.channel_name,
      channel_url: lead.channel_url,
      subscriber_count: lead.subscriber_count,
      email: lead.email,
      platform: lead.platform,
      source_type: lead.source_type,
      discovery_keyword: lead.discovery_keyword,
      confidence_score: lead.confidence_score,
      existing_enrichment: enrichment
    }
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

defmodule LeadResearcher.Quality do
  @moduledoc """
  Job-level quality metrics computation.
  Uses classify_workflow_state/1 for mutually exclusive workflow state counts.
  """

  def compute_job_quality(leads) do
    total = length(leads)
    reviewable = total

    contact_present = Enum.count(leads, &has_effective_email?/1)
    valid_email = Enum.count(leads, &(&1.email_status == "valid_syntax"))
    invalid_email = Enum.count(leads, &(&1.email_status == "invalid_syntax"))
    user_corrected = Enum.count(leads, &(&1.email_status == "user_corrected"))
    audience_present = Enum.count(leads, &has_effective_audience?/1)
    enriched = Enum.count(leads, &(&1.enrichment_status == "completed"))

    # Contact readiness metrics
    platform_suspect = Enum.count(leads, &(&1.contact_readiness == "platform_suspect"))
    no_email_leads = Enum.count(leads, &(&1.contact_readiness == "no_email"))

    contact_coverage = safe_rate(contact_present, reviewable)
    valid_email_coverage = safe_rate(valid_email + user_corrected, reviewable)
    invalid_email_rate = safe_rate(invalid_email, contact_present)
    audience_coverage = safe_rate(audience_present, reviewable)
    enrichment_coverage = safe_rate(enriched, reviewable)

    judgment = compute_judgment(valid_email_coverage, invalid_email_rate, audience_coverage)

    # Classify each lead into exactly one workflow state
    state_counts = Enum.reduce(leads, %{}, fn lead, acc ->
      state = classify_workflow_state(lead)
      Map.update(acc, state, 1, &(&1 + 1))
    end)

    gc = fn key -> Map.get(state_counts, key, 0) end

    %{
      total_leads: total,
      reviewable_leads: reviewable,
      contact_present_leads: contact_present,
      valid_email_leads: valid_email,
      invalid_email_leads: invalid_email,
      user_corrected_leads: user_corrected,
      contact_coverage_rate: contact_coverage,
      valid_email_coverage_rate: valid_email_coverage,
      invalid_email_rate: invalid_email_rate,
      audience_present_leads: audience_present,
      audience_coverage_rate: audience_coverage,
      enrichment_completed_leads: enriched,
      enrichment_coverage_rate: enrichment_coverage,
      judgment: judgment,
      suggested_supplement: suggest_supplement(judgment),
      # Contact readiness metrics
      platform_suspect_leads: platform_suspect,
      no_email_leads: no_email_leads,
      # Workflow state counts (mutually exclusive)
      unreviewed_leads: gc.(:unreviewed),
      needs_enrichment_leads: gc.(:needs_enrichment),
      contactable_leads: gc.(:contactable),
      on_hold_leads: gc.(:on_hold),
      excluded_leads: gc.(:excluded),
      synced_leads: gc.(:synced),
      conflict_queue_leads: gc.(:conflict_queue),
      ready_to_sync_leads: gc.(:ready_to_sync),
      # Backward compat aliases
      needs_verification_leads: gc.(:unreviewed),
      needs_correction_leads: gc.(:needs_enrichment),
      held_leads: gc.(:on_hold),
      needs_review_leads: gc.(:unreviewed),
    }
  end

  @doc """
  Classify a lead into exactly one workflow state.
  Priority order ensures mutual exclusivity.
  """
  def classify_workflow_state(lead) do
    cond do
      lead.master_sync_status == "synced" -> :synced
      lead.master_sync_status == "conflict_queue" -> :conflict_queue
      lead.master_sync_status == "ready_to_sync" -> :ready_to_sync
      lead.review_status in ["rejected", "auto_rejected"] -> :excluded
      lead.review_status == "held" -> :on_hold
      needs_enrichment?(lead) -> :needs_enrichment
      lead.contact_readiness in ["contactable", "user_confirmed"] -> :contactable
      true -> :unreviewed
    end
  end

  defp needs_enrichment?(lead) do
    lead.contact_readiness == "no_email" or
      (is_nil(lead.subscriber_count) and is_nil(lead.audience_size_override)) or
      lead.enrichment_status in ["not_started", "failed"]
  end

  defp compute_judgment(valid_email_coverage, invalid_email_rate, audience_coverage) do
    cond do
      valid_email_coverage < 0.3 -> "low_email_coverage"
      invalid_email_rate > 0.3 -> "high_invalid_email_rate"
      audience_coverage < 0.3 -> "low_audience_coverage"
      true -> "healthy"
    end
  end

  defp suggest_supplement("low_email_coverage"), do: "email_supplement"
  defp suggest_supplement("high_invalid_email_rate"), do: "email_supplement"
  defp suggest_supplement("low_audience_coverage"), do: "audience_supplement"
  defp suggest_supplement(_), do: nil

  defp has_effective_email?(lead) do
    has_value?(lead.contact_email) or has_value?(lead.email)
  end

  defp has_effective_audience?(lead) do
    not is_nil(lead.audience_size_override) or not is_nil(lead.subscriber_count)
  end

  defp has_value?(nil), do: false
  defp has_value?(""), do: false
  defp has_value?(_), do: true

  defp safe_rate(_numerator, 0), do: 0.0
  defp safe_rate(numerator, denominator), do: Float.round(numerator / denominator, 4)
end

defmodule LeadResearcher.Quality do
  @moduledoc """
  Job-level quality metrics computation.
  All coverage rates use reviewable_leads as denominator.
  """

  def compute_job_quality(leads) do
    total = length(leads)
    # reviewable = all leads (crawler only emits validated leads)
    reviewable = total

    contact_present = Enum.count(leads, &has_effective_email?/1)
    valid_email = Enum.count(leads, &(&1.email_status == "valid_syntax"))
    invalid_email = Enum.count(leads, &(&1.email_status == "invalid_syntax"))
    user_corrected = Enum.count(leads, &(&1.email_status == "user_corrected"))
    audience_present = Enum.count(leads, &has_effective_audience?/1)
    enriched = Enum.count(leads, &(&1.enrichment_status == "completed"))

    contact_coverage = safe_rate(contact_present, reviewable)
    valid_email_coverage = safe_rate(valid_email + user_corrected, reviewable)
    invalid_email_rate = safe_rate(invalid_email, contact_present)
    audience_coverage = safe_rate(audience_present, reviewable)
    enrichment_coverage = safe_rate(enriched, reviewable)

    judgment = compute_judgment(valid_email_coverage, invalid_email_rate, audience_coverage)

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
      suggested_supplement: suggest_supplement(judgment)
    }
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

  # effective email = contact_email (user override) || email (raw crawler)
  defp has_effective_email?(lead) do
    has_value?(lead.contact_email) or has_value?(lead.email)
  end

  # effective audience = audience_size_override || subscriber_count
  defp has_effective_audience?(lead) do
    not is_nil(lead.audience_size_override) or not is_nil(lead.subscriber_count)
  end

  defp has_value?(nil), do: false
  defp has_value?(""), do: false
  defp has_value?(_), do: true

  defp safe_rate(_numerator, 0), do: 0.0
  defp safe_rate(numerator, denominator), do: Float.round(numerator / denominator, 4)
end

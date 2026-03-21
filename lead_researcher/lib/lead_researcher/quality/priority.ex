defmodule LeadResearcher.Quality.Priority do
  @moduledoc """
  Priority score computation for leads (0-100).
  Stored as DB column, recomputed on relevant field changes.

  Score components:
  - contact_score (max 45): CRM핵심 — 연락 가능해야 의미
  - audience_score (max 25): 큰 채널일수록 가치 높음
  - enrichment_score (max 15): enrichment 완료 = 판단 근거 충분
  - source_score (max 10): confidence_score 반영
  - recency_score (max 10): 최근 발견 = 더 관련성 높음
  """

  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Leads.Lead

  @doc "Compute priority score for a single lead struct"
  def compute(lead) do
    contact_score(lead) +
      audience_score(lead) +
      enrichment_score(lead) +
      source_score(lead) +
      recency_score(lead)
  end

  @doc "Recompute and persist priority_score for a single lead"
  def recompute_for_lead(%Lead{} = lead) do
    score = compute(lead)

    lead
    |> Ecto.Changeset.change(%{priority_score: score})
    |> Repo.update()
  end

  @doc "Recompute priority_score for all leads in a job"
  def recompute_for_job(job_id) do
    leads =
      Lead
      |> where([l], l.job_id == ^job_id)
      |> Repo.all()

    Enum.each(leads, fn lead ->
      score = compute(lead)

      lead
      |> Ecto.Changeset.change(%{priority_score: score})
      |> Repo.update!()
    end)

    {:ok, length(leads)}
  end

  # --- Score Components ---

  defp contact_score(lead) do
    case lead.contact_readiness do
      "user_confirmed" -> 45
      "contactable" -> 40
      "platform_suspect" -> 20
      "needs_verification" -> 15
      "no_email" -> 5
      _ -> 0
    end
  end

  defp audience_score(lead) do
    tier = lead.audience_tier_override || lead.audience_tier

    case tier do
      "mega" -> 25
      "macro" -> 20
      "mid" -> 15
      "micro" -> 10
      "nano" -> 5
      _ -> 0
    end
  end

  defp enrichment_score(lead) do
    case lead.enrichment_status do
      "completed" -> 15
      "low_confidence" -> 8
      _ -> 0
    end
  end

  defp source_score(lead) do
    score = lead.confidence_score || 0.0
    min(round(score * 10), 10)
  end

  defp recency_score(lead) do
    days = DateTime.diff(DateTime.utc_now(), lead.inserted_at, :day)

    cond do
      days <= 1 -> 10
      days <= 3 -> 7
      days <= 7 -> 4
      true -> 1
    end
  end
end

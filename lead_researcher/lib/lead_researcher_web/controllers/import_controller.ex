defmodule LeadResearcherWeb.ImportController do
  use LeadResearcherWeb, :controller

  alias LeadResearcher.Enrichments
  alias LeadResearcher.Enrichments.JobKeywordSuggestion
  alias LeadResearcher.Repo

  @enrichment_fields ~w(lead_id business_summary descriptor_keywords content_topics trend_summary suggested_email operator_notes)

  def import_enrichments(conn, %{"enrichments" => enrichments_list} = params) do
    operator_id = Map.get(params, "operator_id", "unknown")

    # Whitelist fields
    cleaned =
      Enum.map(enrichments_list, fn entry ->
        Map.take(entry, @enrichment_fields)
      end)

    result = Enrichments.bulk_import(cleaned, operator_id)

    json(conn, result)
  end

  def import_enrichments(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "enrichments 배열이 필요합니다"})
  end

  def import_keywords(conn, %{"job_keywords" => job_keywords_list} = params) do
    operator_id = Map.get(params, "operator_id", "unknown")

    results =
      Enum.reduce(job_keywords_list, %{imported: 0, errors: []}, fn entry, acc ->
        job_id = Map.get(entry, "job_id")
        keywords = Map.get(entry, "suggested_keywords", [])
        notes = Map.get(entry, "notes")

        case LeadResearcher.Repo.get(LeadResearcher.Jobs.Job, job_id) do
          nil ->
            error = %{job_id: job_id, error: "job not found"}
            %{acc | errors: [error | acc.errors]}

          _job ->
            attrs = %{
              job_id: job_id,
              suggested_keywords: Jason.encode!(keywords),
              operator_id: operator_id,
              notes: notes
            }

            case %JobKeywordSuggestion{}
                 |> JobKeywordSuggestion.changeset(attrs)
                 |> Repo.insert() do
              {:ok, _} ->
                %{acc | imported: acc.imported + 1}

              {:error, _changeset} ->
                error = %{job_id: job_id, error: "insert failed"}
                %{acc | errors: [error | acc.errors]}
            end
        end
      end)

    json(conn, %{results | errors: Enum.reverse(results.errors)})
  end

  def import_keywords(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "job_keywords 배열이 필요합니다"})
  end
end

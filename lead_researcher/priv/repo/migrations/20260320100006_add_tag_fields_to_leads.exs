defmodule LeadResearcher.Repo.Migrations.AddTagFieldsToLeads do
  use Ecto.Migration

  @tag_map %{
    "금융/투자" => ~w(재테크 투자 주식 부동산 금융 경제 ETF 펀드 저축 finance investment stock),
    "뷰티/패션" => ~w(뷰티 메이크업 화장 패션 스타일 beauty fashion),
    "교육/학습" => ~w(강의 교육 공부 학습 튜토리얼 education),
    "테크/리뷰" => ~w(리뷰 언박싱 IT 테크 tech review gadget),
    "요리/음식" => ~w(요리 레시피 맛집 먹방 food cooking),
    "라이프스타일" => ~w(일상 브이로그 vlog lifestyle),
    "건강/피트니스" => ~w(운동 헬스 다이어트 건강 fitness health),
  }

  def change do
    alter table(:leads) do
      add :discovery_keywords, :text
      add :normalized_tags, :text
    end

    alter table(:lead_enrichments) do
      add :profile_tags, :text
    end

    flush()

    # Backfill: convert existing discovery_keyword (single string) to discovery_keywords (JSON array)
    # and compute normalized_tags
    execute(fn ->
      repo().query!("SELECT id, discovery_keyword FROM leads WHERE discovery_keyword IS NOT NULL AND discovery_keyword != ''")
      |> then(fn %{rows: rows} ->
        for [id, keyword] <- rows do
          keywords = [keyword]
          normalized = normalize(keywords)
          keywords_json = Jason.encode!(keywords)
          normalized_json = Jason.encode!(normalized)
          repo().query!("UPDATE leads SET discovery_keywords = ?1, normalized_tags = ?2 WHERE id = ?3",
            [keywords_json, normalized_json, id])
        end
      end)
    end, fn -> :ok end)
  end

  defp normalize(keywords) do
    keywords
    |> Enum.flat_map(&match_categories/1)
    |> Enum.uniq()
  end

  defp match_categories(keyword) do
    normalized = String.downcase(keyword)
    @tag_map
    |> Enum.filter(fn {_cat, words} ->
      Enum.any?(words, &String.contains?(normalized, String.downcase(&1)))
    end)
    |> Enum.map(fn {cat, _} -> cat end)
  end
end

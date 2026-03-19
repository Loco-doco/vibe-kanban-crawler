defmodule LeadResearcher.TagNormalizer do
  @moduledoc """
  Normalizes discovery keywords into standard category tags.
  """

  @tag_map %{
    "금융/투자" => ~w(재테크 투자 주식 부동산 금융 경제 ETF 펀드 저축 finance investment stock),
    "뷰티/패션" => ~w(뷰티 메이크업 화장 패션 스타일 beauty fashion),
    "교육/학습" => ~w(강의 교육 공부 학습 튜토리얼 education),
    "테크/리뷰" => ~w(리뷰 언박싱 IT 테크 tech review gadget),
    "요리/음식" => ~w(요리 레시피 맛집 먹방 food cooking),
    "라이프스타일" => ~w(일상 브이로그 vlog lifestyle),
    "건강/피트니스" => ~w(운동 헬스 다이어트 건강 fitness health),
  }

  @doc """
  Normalize a list of keywords into standard category tags.
  Returns a list of unique category strings.
  """
  def normalize(keywords) when is_list(keywords) do
    keywords
    |> Enum.flat_map(&match_categories/1)
    |> Enum.uniq()
  end

  def normalize(_), do: []

  defp match_categories(keyword) when is_binary(keyword) do
    normalized = String.downcase(keyword)

    @tag_map
    |> Enum.filter(fn {_cat, words} ->
      Enum.any?(words, &String.contains?(normalized, String.downcase(&1)))
    end)
    |> Enum.map(fn {cat, _} -> cat end)
  end

  defp match_categories(_), do: []
end

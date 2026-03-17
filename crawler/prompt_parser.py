#!/usr/bin/env python3
"""
Prompt Parser — uses Claude API to extract structured search parameters
from a natural language description.

Reads JSON from stdin: {"prompt": "...", "api_key": "..."}
Outputs JSON to stdout: {"keywords": [...], "category_tags": [...], ...}
"""
import sys
import json
import requests

SYSTEM_PROMPT = """당신은 YouTube 크리에이터 검색 쿼리 파서입니다.
사용자가 자연어로 어떤 크리에이터를 찾고 싶은지 설명하면, 그것을 YouTube 검색에 적합한 구조화된 검색 파라미터로 변환합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "keywords": ["검색 키워드1", "검색 키워드2"],
  "category_tags": ["카테고리1", "카테고리2"],
  "subscriber_min": null,
  "subscriber_max": null
}

규칙:
1. keywords: YouTube 검색에 직접 사용할 키워드 배열. 최소 1개, 최대 5개. 한국어 검색에 최적화.
   - 예: "뷰티 유튜버", "스킨케어 리뷰", "화장품 추천 유튜버" 등
   - 사용자의 의도를 파악해서 실제 YouTube에서 채널을 찾을 수 있는 검색어로 변환
2. category_tags: 관련 카테고리 태그 배열. 없으면 빈 배열.
3. subscriber_min: 최소 구독자 수 (정수). 언급 없으면 null.
   - "소규모" = 1000, "중소형" = 10000, "중형" = 50000, "대형" = 100000, "메가" = 1000000
   - "만" = 10000, "십만" = 100000, "백만" = 1000000
4. subscriber_max: 최대 구독자 수 (정수). 언급 없으면 null.
"""


def parse_prompt(prompt, api_key):
    """Call Claude API to parse a natural language prompt into search parameters."""
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 512,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30,
    )

    if response.status_code != 200:
        return {"error": f"Claude API error: {response.status_code} {response.text[:200]}"}

    data = response.json()
    text = data.get("content", [{}])[0].get("text", "")

    try:
        # Parse the JSON response from Claude
        parsed = json.loads(text)
        # Validate required fields
        result = {
            "keywords": parsed.get("keywords", []),
            "category_tags": parsed.get("category_tags", []),
            "subscriber_min": parsed.get("subscriber_min"),
            "subscriber_max": parsed.get("subscriber_max"),
        }
        if not result["keywords"]:
            return {"error": "키워드를 추출할 수 없습니다. 더 구체적으로 입력해주세요."}
        return result
    except json.JSONDecodeError:
        return {"error": f"AI 응답 파싱 실패: {text[:200]}"}


def main():
    input_line = sys.stdin.readline().strip()
    if not input_line:
        print(json.dumps({"error": "No input received"}))
        return

    try:
        config = json.loads(input_line)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        return

    prompt = config.get("prompt", "")
    api_key = config.get("api_key", "")

    if not prompt:
        print(json.dumps({"error": "프롬프트가 비어있습니다"}))
        return

    if not api_key:
        # Fallback: treat the prompt as comma-separated keywords
        keywords = [k.strip() for k in prompt.replace("\n", ",").split(",") if k.strip()]
        print(json.dumps({
            "keywords": keywords[:5],
            "category_tags": [],
            "subscriber_min": None,
            "subscriber_max": None,
        }))
        return

    result = parse_prompt(prompt, api_key)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

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


def fallback_parse(prompt):
    """Parse prompt locally without AI — extract keywords, subscriber range, categories."""
    import re

    text = prompt.strip()

    # --- Extract subscriber range ---
    subscriber_min = None
    subscriber_max = None

    # Korean number units
    units = {"만": 10_000, "십만": 100_000, "백만": 1_000_000, "천만": 10_000_000, "억": 100_000_000}

    # Pattern: "구독자 5만~50만", "구독자 1만 이상", "구독자 100만 이하"
    # Also: "5만에서 50만", "5만 ~ 50만", "5만~50만 사이"
    range_pattern = r"(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?\s*(?:~|에서|부터|-)\s*(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?"
    m = re.search(range_pattern, text)
    if m:
        min_num = float(m.group(1))
        min_unit = units.get(m.group(2), 1) if m.group(2) else 1
        max_num = float(m.group(3))
        max_unit = units.get(m.group(4), 1) if m.group(4) else 1
        # If max has no unit but min does, assume same unit
        if m.group(2) and not m.group(4):
            max_unit = min_unit
        subscriber_min = int(min_num * min_unit)
        subscriber_max = int(max_num * max_unit)
    else:
        # "구독자 N만 이상" or "N만 이상"
        min_m = re.search(r"(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?\s*이상", text)
        if min_m:
            num = float(min_m.group(1))
            unit = units.get(min_m.group(2), 1) if min_m.group(2) else 1
            subscriber_min = int(num * unit)

        # "구독자 N만 이하" or "N만 이하" or "N만 미만"
        max_m = re.search(r"(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?\s*(?:이하|미만)", text)
        if max_m:
            num = float(max_m.group(1))
            unit = units.get(max_m.group(2), 1) if max_m.group(2) else 1
            subscriber_max = int(num * unit)

    # Size keywords → subscriber range
    size_map = {
        "소규모": (1_000, 50_000),
        "소형": (1_000, 50_000),
        "중소형": (10_000, 100_000),
        "중형": (50_000, 500_000),
        "대형": (100_000, 1_000_000),
        "메가": (1_000_000, None),
    }
    for keyword, (s_min, s_max) in size_map.items():
        if keyword in text:
            if subscriber_min is None:
                subscriber_min = s_min
            if subscriber_max is None and s_max:
                subscriber_max = s_max
            break

    # --- Remove noise phrases and extract meaningful keywords ---
    # Remove subscriber-related text
    cleaned = re.sub(r"구독자\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:~|에서|부터|-)\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:사이)?", "", text)
    cleaned = re.sub(r"구독자\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:이상|이하|미만)", "", cleaned)
    cleaned = re.sub(r"\d+[\d.]*\s*(?:만|십만|백만|천만|억)\s*(?:명)?\s*(?:~|에서|부터|-)\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:사이)?", "", cleaned)
    cleaned = re.sub(r"\d+[\d.]*\s*(?:만|십만|백만|천만|억)\s*(?:명)?\s*(?:이상|이하|미만)", "", cleaned)

    # Remove subscriber range text more aggressively (catch trailing particles)
    cleaned = re.sub(r"구독자[^,，\n]*?(?:이상|이하|미만|사이)[인은의를에]?\s*(?:곳|것|채널|데)?", "", cleaned)

    # Remove filler words (longer first to avoid partial matches)
    filler = [
        "찾아주세요", "찾아보세요", "찾고 싶어", "알려주세요",
        "추천해주세요", "검색해주세요",
        "찾아줘", "알려줘", "추천해줘", "검색해줘",
        "중에서", "사이에", "위주로",
        "중에", "사이", "위주",
        "관련된", "관련한", "관련",
        "소규모", "중소형", "중형", "대형", "메가",
        "채널인데", "채널이고", "채널인", "채널",
        "크리에이터", "유튜버",
        # Sentence-level fillers
        "한국인", "한국",
        "콘텐츠를 올리거나", "콘텐츠를 만드는", "콘텐츠를 하는",
        "경험이 있는", "경험이 있거나", "경험 있는",
        "아니면", "또는", "혹은", "이거나", "올리거나",
        "하는", "있는", "하거나", "없는",
        "인데", "이고", "이며", "하고",
        "좀", "한번", "정도", "쯤", "약", "대략",
        "키워드",
    ]
    for word in filler:
        cleaned = cleaned.replace(word, " ")

    # Remove single-char leftover particles (Korean postpositions/fillers)
    cleaned = re.sub(r"(?<!\S)[은는이가을를에서의로도인곳데중]\s", " ", cleaned)
    cleaned = re.sub(r"(?<!\S)[은는이가을를에서의로도인곳데중]$", "", cleaned)

    # Split into meaningful segments by commas, newlines, periods, and conjunctions
    segments = re.split(r"[,，\n.。/]+", cleaned)
    keywords = []
    for seg in segments:
        seg = seg.strip()
        seg = re.sub(r"\s+", " ", seg)
        if seg and len(seg) >= 2:
            keywords.append(seg)

    # Post-process: break very long keywords (>15 chars) into noun phrases
    final_keywords = []
    for kw in keywords:
        if len(kw) > 15:
            # Try splitting by spaces and grouping into 2-3 word chunks
            words = kw.split()
            if len(words) >= 3:
                # Take meaningful 2-word pairs
                for i in range(0, len(words), 2):
                    chunk = " ".join(words[i:i+2])
                    if len(chunk) >= 2:
                        final_keywords.append(chunk)
            else:
                final_keywords.append(kw)
        else:
            final_keywords.append(kw)

    # Deduplicate
    seen = set()
    unique_keywords = []
    for kw in final_keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            unique_keywords.append(kw)

    # If no keywords extracted, use the first meaningful part of the original prompt
    if not unique_keywords:
        # Take the first sentence/clause as a keyword
        first = re.split(r"[,，\n.。]", text)[0].strip()
        if first:
            unique_keywords = [first[:30]]

    # --- Extract category tags ---
    category_map = {
        "뷰티": ["뷰티", "화장", "메이크업", "스킨케어", "화장품", "코스메틱"],
        "요리": ["요리", "레시피", "쿠킹", "음식", "맛집", "먹방"],
        "게임": ["게임", "겜", "롤", "배그", "마크", "스트리머"],
        "IT/테크": ["IT", "개발", "프로그래밍", "코딩", "앱", "기술", "테크놀로지"],
        "교육": ["교육", "공부", "강의", "학습", "입시"],
        "자기계발": ["자기계발", "동기부여", "독서", "자기관리"],
        "재테크": ["재테크", "투자", "주식", "부동산", "경제", "금융"],
        "여행": ["여행", "트래블", "해외", "국내여행"],
        "패션": ["패션", "옷", "스타일", "코디", "의류"],
        "건강": ["건강", "헬스", "다이어트", "운동", "피트니스", "요가"],
        "음악": ["음악", "노래", "악기", "보컬", "커버"],
        "반려동물": ["반려동물", "고양이", "강아지", "펫", "애완"],
    }

    category_tags = []
    text_lower = text.lower()
    for cat, cat_keywords in category_map.items():
        for ck in cat_keywords:
            if ck in text_lower:
                category_tags.append(cat)
                break

    return {
        "keywords": unique_keywords[:5],
        "category_tags": category_tags,
        "subscriber_min": subscriber_min,
        "subscriber_max": subscriber_max,
    }


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
        # Fallback: basic Korean NLP parsing without AI
        result = fallback_parse(prompt)
        result["_fallback"] = True
        print(json.dumps(result, ensure_ascii=False))
        return

    result = parse_prompt(prompt, api_key)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

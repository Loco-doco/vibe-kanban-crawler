#!/usr/bin/env python3
"""
Prompt Parser — extracts structured search parameters from natural language.

Protocol:
  stdin:  {"prompt": "...", "api_key": "..."}
  stdout: {"keywords": [...], "parse_mode": "ai"|"fallback", ...}

Routes:
  api_key present → AI parse (Claude API) → on failure → fallback
  api_key absent  → fallback parse (rule-based)
"""
import sys
import json
import re

SYSTEM_PROMPT = """당신은 YouTube 크리에이터 탐색 전문가입니다.
사용자가 자연어로 찾고 싶은 크리에이터를 설명하면, YouTube에서 실제로 그런 크리에이터를 발견할 수 있는 **검색 전략**을 설계합니다.

핵심 원칙:
- 사용자의 비즈니스 의도를 파악하고, 그 의도에 맞는 크리에이터가 YouTube에서 어떤 콘텐츠를 올리는지 역추론하세요.
- "실물 상품을 파는 크리에이터"를 찾으려면 → "유튜버 굿즈", "크리에이터 자체 브랜드", "유튜버 쇼핑몰 운영" 같은 키워드가 유효합니다.
- "온라인 강의를 하는 크리에이터"를 찾으려면 → "유튜버 클래스", "강의 유튜버", "온라인 코칭" 등이 유효합니다.
- 사용자가 말한 문장을 그대로 검색어로 쓰면 안 됩니다. YouTube 검색에서 채널이 실제로 노출될 수 있는 검색어를 만들어야 합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "keywords": ["YouTube 검색 키워드1", "검색 키워드2", ...],
  "category_tags": ["카테고리1"],
  "subscriber_min": null,
  "subscriber_max": null,
  "extra_conditions": "검색으로는 필터링 불가능한 비즈니스 조건 요약"
}

규칙:
1. keywords (최소 1개, 최대 5개):
   - YouTube 검색에서 **채널**이 발견될 수 있는 검색어. 한국어 최적화.
   - 사용자의 의도를 분석하여, 해당 프로필의 크리에이터가 올릴 법한 콘텐츠 주제/니치를 키워드로 변환.
   - 다양한 검색 각도를 커버하세요 (콘텐츠 주제 + 크리에이터 유형 + 활동 형태).
   - 예시:
     - "스킨케어 제품도 파는 뷰티 유튜버" → ["뷰티 유튜버 자체 브랜드", "스킨케어 추천 유튜버", "화장품 리뷰 크리에이터", "뷰티 유튜버 쇼핑몰"]
     - "부업이나 재테크 알려주는 소규모 채널" → ["부업 유튜버", "재테크 초보 강의", "투잡 브이로그", "월급 외 수입"]
2. category_tags: 관련 카테고리 태그 배열. 없으면 빈 배열.
3. subscriber_min / subscriber_max: 구독자 수 범위 (정수). 언급 없으면 null.
   - "소규모" = 1000, "중소형" = 10000, "중형" = 50000, "대형" = 100000
   - "만" = 10000, "십만" = 100000
4. extra_conditions: 검색 키워드만으로는 필터링할 수 없는 비즈니스 조건을 한 문장으로 요약.
   - 예: "실물 결합 상품을 판매하는 크리에이터", "기업 협업 경험이 있는 크리에이터"
   - 이 조건은 크롤링 후 사람이 리뷰할 때 참고 기준으로 사용됩니다.
   - 특별한 비즈니스 조건이 없으면 null.
"""


def log(message):
    """Debug log to stderr (captured by Elixir but not mixed with JSON output)."""
    print(f"[prompt_parser] {message}", file=sys.stderr, flush=True)


# ────────────────────────────────────────────
# AI Parse: Claude API
# ────────────────────────────────────────────

def ai_parse(prompt, api_key):
    """
    Call Anthropic Messages API to parse prompt.
    Returns (result_dict, None) on success, (None, error_string) on failure.
    """
    import requests

    log(f"ai_parse: calling Claude API (prompt length={len(prompt)})")

    try:
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
    except requests.exceptions.Timeout:
        log("ai_parse: TIMEOUT — API did not respond within 30s")
        return None, "timeout"
    except requests.exceptions.ConnectionError as e:
        log(f"ai_parse: CONNECTION_ERROR — {e}")
        return None, "connection_error"
    except requests.exceptions.RequestException as e:
        log(f"ai_parse: REQUEST_ERROR — {e}")
        return None, "request_error"

    if response.status_code != 200:
        log(f"ai_parse: API_ERROR — status={response.status_code} body={response.text[:200]}")
        return None, f"api_error_{response.status_code}"

    data = response.json()
    text = data.get("content", [{}])[0].get("text", "")

    if not text:
        log("ai_parse: EMPTY_RESPONSE — no text in API response")
        return None, "empty_response"

    # Strip markdown code blocks if present
    stripped = re.sub(r"^```(?:json)?\s*\n?", "", text.strip())
    stripped = re.sub(r"\n?```\s*$", "", stripped)

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        log(f"ai_parse: JSON_PARSE_ERROR — raw text: {text[:200]}")
        return None, "json_parse_error"

    keywords = parsed.get("keywords", [])
    if not keywords:
        log("ai_parse: NO_KEYWORDS — AI returned empty keywords")
        return None, "no_keywords"

    result = {
        "keywords": keywords[:5],
        "category_tags": parsed.get("category_tags", []),
        "subscriber_min": parsed.get("subscriber_min"),
        "subscriber_max": parsed.get("subscriber_max"),
        "extra_conditions": parsed.get("extra_conditions"),
        "parse_mode": "ai",
    }
    log(f"ai_parse: OK — keywords={result['keywords']}")
    return result, None


# ────────────────────────────────────────────
# Fallback Parse: Rule-based (no AI)
# ────────────────────────────────────────────

def fallback_parse(prompt):
    """Parse prompt locally without AI — extract keywords, subscriber range, categories."""
    log(f"fallback_parse: starting (prompt length={len(prompt)})")
    text = prompt.strip()

    # --- Extract subscriber range ---
    subscriber_min = None
    subscriber_max = None

    units = {"만": 10_000, "십만": 100_000, "백만": 1_000_000, "천만": 10_000_000, "억": 100_000_000}

    range_pattern = r"(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?\s*(?:~|에서|부터|-)\s*(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?"
    m = re.search(range_pattern, text)
    if m:
        min_num = float(m.group(1))
        min_unit = units.get(m.group(2), 1) if m.group(2) else 1
        max_num = float(m.group(3))
        max_unit = units.get(m.group(4), 1) if m.group(4) else 1
        if m.group(2) and not m.group(4):
            max_unit = min_unit
        subscriber_min = int(min_num * min_unit)
        subscriber_max = int(max_num * max_unit)
    else:
        min_m = re.search(r"(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?\s*이상", text)
        if min_m:
            num = float(min_m.group(1))
            unit = units.get(min_m.group(2), 1) if min_m.group(2) else 1
            subscriber_min = int(num * unit)

        max_m = re.search(r"(\d+(?:\.\d+)?)\s*(만|십만|백만|천만|억)?\s*(?:명)?\s*(?:이하|미만)", text)
        if max_m:
            num = float(max_m.group(1))
            unit = units.get(max_m.group(2), 1) if max_m.group(2) else 1
            subscriber_max = int(num * unit)

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
    cleaned = re.sub(r"구독자\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:~|에서|부터|-)\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:사이)?", "", text)
    cleaned = re.sub(r"구독자\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:이상|이하|미만)", "", cleaned)
    cleaned = re.sub(r"\d+[\d.]*\s*(?:만|십만|백만|천만|억)\s*(?:명)?\s*(?:~|에서|부터|-)\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:사이)?", "", cleaned)
    cleaned = re.sub(r"\d+[\d.]*\s*(?:만|십만|백만|천만|억)\s*(?:명)?\s*(?:이상|이하|미만)", "", cleaned)
    cleaned = re.sub(r"구독자[^,，\n]*?(?:이상|이하|미만|사이)[인은의를에]?\s*(?:곳|것|채널|데)?", "", cleaned)

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

    cleaned = re.sub(r"(?<!\S)[은는이가을를에서의로도인곳데중]\s", " ", cleaned)
    cleaned = re.sub(r"(?<!\S)[은는이가을를에서의로도인곳데중]$", "", cleaned)

    segments = re.split(r"[,，\n.。/]+", cleaned)
    keywords = []
    for seg in segments:
        seg = seg.strip()
        seg = re.sub(r"\s+", " ", seg)
        if seg and len(seg) >= 2:
            keywords.append(seg)

    final_keywords = []
    for kw in keywords:
        if len(kw) > 15:
            words = kw.split()
            if len(words) >= 3:
                for i in range(0, len(words), 2):
                    chunk = " ".join(words[i:i+2])
                    if len(chunk) >= 2:
                        final_keywords.append(chunk)
            else:
                final_keywords.append(kw)
        else:
            final_keywords.append(kw)

    seen = set()
    unique_keywords = []
    for kw in final_keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            unique_keywords.append(kw)

    if not unique_keywords:
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

    result = {
        "keywords": unique_keywords[:5],
        "category_tags": category_tags,
        "subscriber_min": subscriber_min,
        "subscriber_max": subscriber_max,
        "extra_conditions": None,
        "parse_mode": "fallback",
        "_fallback": True,
    }
    log(f"fallback_parse: OK — keywords={result['keywords']}")
    return result


# ────────────────────────────────────────────
# Main entry point
# ────────────────────────────────────────────

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

    # Route 1: API key present → try AI, fallback on failure
    if api_key:
        result, error = ai_parse(prompt, api_key)
        if result:
            print(json.dumps(result, ensure_ascii=False))
            return

        # AI failed — fall through to fallback with reason logged
        log(f"ai_parse failed ({error}), falling back to rule-based parser")
        result = fallback_parse(prompt)
        result["_ai_error"] = error
        print(json.dumps(result, ensure_ascii=False))
        return

    # Route 2: No API key → fallback only
    log("no api_key provided, using fallback parser")
    result = fallback_parse(prompt)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

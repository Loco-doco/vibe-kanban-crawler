#!/usr/bin/env python3
"""
Prompt Parser — extracts structured search parameters from natural language.

Protocol:
  stdin:  {"prompt": "..."}
  stdout: {"search_clues": [...], "parse_mode": "rule_based", ...}

Rule-based parser only. No external AI API required.
"""
import sys
import json
import re


def log(message):
    """Debug log to stderr (captured by Elixir but not mixed with JSON output)."""
    print(f"[prompt_parser] {message}", file=sys.stderr, flush=True)


PLATFORM_NAMES = {
    "유튜브": "youtube", "youtube": "youtube",
    "인스타": "instagram", "인스타그램": "instagram", "instagram": "instagram",
    "liveklass": "liveklass", "라이브클라스": "liveklass",
    "classu": "classu", "클래수": "classu",
    "class101": "class101", "클래스101": "class101",
    "탈잉": "taling", "클래스팅": "classting",
}

PERSONA_MARKERS = [
    "유튜버", "크리에이터", "블로거", "인플루언서", "채널", "스트리머",
    "강사", "작가", "전문가",
]


def extract_target_persona(text):
    """Extract a persona description from the prompt text.
    Looks for clauses containing persona markers and captures surrounding context."""
    # Split by major delimiters
    clauses = re.split(r"[,，.。\n]+", text)
    persona_parts = []
    for clause in clauses:
        clause = clause.strip()
        if not clause:
            continue
        # Check if clause contains a persona marker
        for marker in PERSONA_MARKERS:
            if marker in clause:
                # Clean up the clause: remove subscriber range patterns, action verbs
                cleaned = re.sub(r"구독자[^,，\n]*", "", clause)
                cleaned = re.sub(r"\d+[\d.]*\s*(?:만|십만|백만|천만|억)\s*(?:명)?\s*(?:~|에서|부터|-)\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?", "", cleaned)
                cleaned = re.sub(r"\d+[\d.]*\s*(?:만|십만|백만|천만|억)\s*(?:명)?\s*(?:이상|이하|미만)", "", cleaned)
                cleaned = re.sub(r"찾아줘|찾아주세요|알려줘|추천해줘|검색해줘|찾고\s*싶어", "", cleaned)
                cleaned = cleaned.strip()
                if cleaned and len(cleaned) >= 2:
                    persona_parts.append(cleaned)
                break
    if persona_parts:
        return ", ".join(persona_parts[:2])
    return None


def extract_exclude_conditions(text):
    """Extract exclusion conditions from text. Returns (exclude_string, cleaned_text)."""
    exclude_parts = []
    cleaned_text = text

    # Pattern: 제외, 빼고, 말고 followed by content
    patterns = [
        r"([^,，\n]*?)\s*(?:제외|빼고|말고)\s*",
        r"(?:제외|빼고|말고)\s*[:：]?\s*([^,，\n]+)",
    ]

    for pattern in patterns:
        for m in re.finditer(pattern, text):
            part = m.group(1).strip() if m.group(1) else ""
            if part and len(part) >= 1 and len(part) <= 30:
                if part not in exclude_parts:
                    exclude_parts.append(part)
            # Remove the matched exclusion from text for keyword extraction
            cleaned_text = cleaned_text.replace(m.group(0), " ")

    if exclude_parts:
        return ", ".join(exclude_parts), cleaned_text
    return None, text


def parse_prompt(prompt):
    """Parse prompt using rule-based extraction."""
    log(f"parse_prompt: starting (prompt length={len(prompt)})")
    text = prompt.strip()
    raw_prompt = text

    # --- Extract platform hints ---
    platform_hints = []
    text_lower_for_platform = text.lower()
    seen_platforms = set()
    for alias, canonical in PLATFORM_NAMES.items():
        if alias.lower() in text_lower_for_platform and canonical not in seen_platforms:
            platform_hints.append(canonical)
            seen_platforms.add(canonical)

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

    # --- Extract target persona ---
    target_persona = extract_target_persona(text)

    # --- Extract exclude conditions ---
    exclude_conditions, text_after_exclude = extract_exclude_conditions(text)

    # --- Remove noise phrases and extract meaningful keywords ---
    cleaned = re.sub(r"구독자\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:~|에서|부터|-)\s*\d+[\d.]*\s*(?:만|십만|백만|천만|억)?\s*(?:명)?\s*(?:사이)?", "", text_after_exclude)
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
    for alias in PLATFORM_NAMES:
        filler.append(alias)
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
        # V2 fields (new frontend)
        "target_persona": target_persona,
        "search_clues": unique_keywords[:5],
        "categories": category_tags,
        "active_platforms": platform_hints,
        "exclude_conditions": exclude_conditions,
        # Backward compat fields (Elixir wrapper + old frontend)
        "keywords": unique_keywords[:5],
        "category_tags": category_tags,
        "platform_hints": platform_hints,
        "extra_conditions": None,
        "semantic_expansions": [],
        # Shared fields
        "subscriber_min": subscriber_min,
        "subscriber_max": subscriber_max,
        "parse_mode": "rule_based",
        "raw_prompt": raw_prompt,
    }
    log(f"parse_prompt: OK — search_clues={result['search_clues']}, persona={target_persona}, exclude={exclude_conditions}")
    return result


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

    if not prompt:
        print(json.dumps({"error": "프롬프트가 비어있습니다"}))
        return

    result = parse_prompt(prompt)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

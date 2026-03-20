"""
Channel enrichment extractor.

Extracts structured profile data from YouTube channel pages using
regex + JSON parsing (no LLM). All values require evidence.

Output protocol:
  {"type": "enrichment", "lead_id": 42, "profile_summary": "...", ...}

Evidence spec per field: method, confidence, fragment.
"""
import re
import json
from datetime import datetime, timezone

from utils.http_client import fetch_with_retry
from utils.youtube_parser import extract_yt_initial_data, extract_subscriber_count


# Per-field extraction confidence levels
EXTRACTION_CONFIDENCE = {
    "channel_metadata_description": 0.95,
    "channel_metadata_keywords": 0.90,
    "keyword_pattern_match": 0.65,
    "video_title_list": 0.85,
    "external_link_parse": 0.80,
    "description_sentence_extract": 0.70,
}

BUSINESS_KEYWORDS = [
    "강의", "클래스", "상품", "브랜드", "상담", "서비스",
    "문의", "광고", "협업", "비즈니스", "사업", "업체",
    "제휴", "스폰서", "마케팅", "컨설팅",
    "business", "brand", "sponsor", "collaboration", "partnership",
]

BUSINESS_TYPE_PATTERNS = {
    "뷰티/패션": ["뷰티", "메이크업", "화장", "패션", "스타일", "beauty", "fashion"],
    "금융/투자": ["재테크", "투자", "주식", "부동산", "금융", "경제", "finance"],
    "교육/학습": ["강의", "교육", "공부", "학습", "튜토리얼", "education"],
    "테크/리뷰": ["리뷰", "언박싱", "IT", "테크", "tech", "review", "gadget"],
    "요리/음식": ["요리", "레시피", "맛집", "먹방", "food", "cooking"],
    "라이프스타일": ["일상", "브이로그", "vlog", "lifestyle"],
    "엔터테인먼트": ["예능", "코미디", "게임", "music", "gaming"],
    "건강/피트니스": ["운동", "헬스", "다이어트", "건강", "fitness", "health"],
}


def _log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)


class ChannelEnricher:
    """Extracts enrichment data from YouTube channel page HTML."""

    TARGET_FIELDS = [
        "profile_summary", "business_summary", "business_type",
        "content_topics", "profile_tags", "recent_activity_summary",
        "secondary_platforms",
    ]

    def __init__(self, config):
        self.max_retries = config.get("max_retries", 3)
        self.delay_ms = config.get("delay_ms", 2000)

    def enrich(self, lead_id, channel_url):
        """
        Fetch channel page and extract enrichment data.
        Returns dict with enrichment fields + evidence, or None on failure.
        """
        html = fetch_with_retry(
            channel_url.rstrip("/"),
            self.max_retries,
            self.delay_ms,
        )
        if not html:
            return None

        yt_data = extract_yt_initial_data(html)
        if not yt_data:
            return None

        # Extract channel metadata
        metadata = (
            yt_data
            .get("metadata", {})
            .get("channelMetadataRenderer", {})
        )
        description = metadata.get("description", "")
        keywords_str = metadata.get("keywords", "")

        # Build enrichment fields with evidence
        fields = {}
        evidence_fields = {}

        # 1. profile_summary (from description)
        if description:
            summary = description[:200].strip()
            if summary:
                fields["profile_summary"] = summary
                evidence_fields["profile_summary"] = {
                    "method": "channel_metadata_description",
                    "confidence": EXTRACTION_CONFIDENCE["channel_metadata_description"],
                    "fragment": f"description[:200]",
                }

        # 2. business_summary (only if business keywords detected)
        biz_summary = self._extract_business_summary(description)
        if biz_summary:
            fields["business_summary"] = biz_summary
            evidence_fields["business_summary"] = {
                "method": "description_sentence_extract",
                "confidence": EXTRACTION_CONFIDENCE["description_sentence_extract"],
                "fragment": biz_summary[:100],
            }

        # 3. business_type (from description + keywords)
        all_text = f"{description} {keywords_str}".lower()
        biz_type = self._classify_business_type(all_text)
        if biz_type:
            fields["business_type"] = biz_type
            matching = [
                kw for kw in BUSINESS_TYPE_PATTERNS.get(biz_type, [])
                if kw.lower() in all_text
            ]
            evidence_fields["business_type"] = {
                "method": "keyword_pattern_match",
                "confidence": EXTRACTION_CONFIDENCE["keyword_pattern_match"],
                "fragment": f"매칭 키워드: {matching[:5]} → '{biz_type}'",
            }

        # 4. content_topics (from keywords metadata)
        if keywords_str:
            topics = [
                kw.strip().strip('"')
                for kw in keywords_str.split(",") if kw.strip()
            ][:20]
            if topics:
                fields["content_topics"] = json.dumps(topics, ensure_ascii=False)
                evidence_fields["content_topics"] = {
                    "method": "channel_metadata_keywords",
                    "confidence": EXTRACTION_CONFIDENCE["channel_metadata_keywords"],
                    "fragment": f"keywords: {', '.join(topics[:5])}...",
                }

        # 5. profile_tags (from keywords + description keywords)
        profile_tags = self._extract_profile_tags(keywords_str, description)
        if profile_tags:
            fields["profile_tags"] = json.dumps(profile_tags, ensure_ascii=False)
            evidence_fields["profile_tags"] = {
                "method": "channel_metadata_keywords",
                "confidence": EXTRACTION_CONFIDENCE["channel_metadata_keywords"],
                "fragment": f"tags: {', '.join(profile_tags[:5])}",
            }

        # 6. recent_videos (from tab content)
        recent_videos = self._extract_recent_videos(yt_data)
        if recent_videos:
            fields["recent_activity_summary"] = "; ".join(
                v["title"] for v in recent_videos[:5]
            )[:300]
            evidence_fields["recent_activity_summary"] = {
                "method": "video_title_list",
                "confidence": EXTRACTION_CONFIDENCE["video_title_list"],
                "fragment": f"{len(recent_videos)} recent videos",
            }

        # 7. secondary_platforms (from external links in header)
        platforms = self._extract_secondary_platforms(html)
        if platforms:
            fields["secondary_platforms"] = json.dumps(platforms, ensure_ascii=False)
            evidence_fields["secondary_platforms"] = {
                "method": "external_link_parse",
                "confidence": EXTRACTION_CONFIDENCE["external_link_parse"],
                "fragment": f"links: {', '.join(platforms[:3])}",
            }

        if not fields:
            return None

        # Compute scores
        filled = len(fields)
        total = len(self.TARGET_FIELDS)
        coverage_score = round(filled / total, 2)

        # evidence_confidence = weighted average of filled field confidences
        confidence_sum = sum(
            evidence_fields[f]["confidence"]
            for f in evidence_fields
        )
        evidence_confidence = round(confidence_sum / filled, 2) if filled > 0 else 0.0

        result = {
            "type": "enrichment",
            "lead_id": lead_id,
            **fields,
            "evidence": {
                "source_url": channel_url,
                "source_type": "youtube_channel_page",
                "extraction_method": "regex_json_parse",
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "coverage_score": coverage_score,
                "evidence_confidence": evidence_confidence,
                "fields": evidence_fields,
            },
        }

        return result

    def _extract_business_summary(self, description):
        """Extract business-related sentences from description. Returns None if no business context."""
        if not description:
            return None
        sentences = re.split(r"[.!?\n]", description)
        business_sentences = [
            s.strip()
            for s in sentences
            if s.strip() and any(kw in s.lower() for kw in BUSINESS_KEYWORDS)
        ]
        if not business_sentences:
            return None
        return " ".join(business_sentences[:3])[:300]

    def _classify_business_type(self, text):
        """Classify business type from text using keyword matching."""
        best_match = None
        best_count = 0
        for biz_type, keywords in BUSINESS_TYPE_PATTERNS.items():
            count = sum(1 for kw in keywords if kw.lower() in text)
            if count > best_count:
                best_count = count
                best_match = biz_type
        return best_match if best_count >= 2 else None

    def _extract_profile_tags(self, keywords_str, description):
        """Extract normalized profile tags from keywords and description."""
        tags = set()

        # From channel keywords
        if keywords_str:
            for kw in keywords_str.split(","):
                cleaned = kw.strip().strip('"').strip()
                if cleaned and 2 <= len(cleaned) <= 20:
                    tags.add(cleaned)

        # From description: extract Korean hashtags
        if description:
            for match in re.finditer(r"#(\w{2,15})", description):
                tags.add(match.group(1))

        return sorted(list(tags))[:15]

    def _extract_recent_videos(self, yt_data):
        """Extract recent video titles from ytInitialData tabs."""
        videos = []
        try:
            tabs = yt_data.get("contents", {}).get(
                "twoColumnBrowseResultsRenderer", {}
            ).get("tabs", [])

            for tab in tabs:
                tab_renderer = tab.get("tabRenderer", {})
                if tab_renderer.get("title") in ("Videos", "동영상"):
                    content = tab_renderer.get("content", {})
                    section = (
                        content
                        .get("richGridRenderer", {})
                        .get("contents", [])
                    )
                    for item in section[:10]:
                        video = (
                            item
                            .get("richItemRenderer", {})
                            .get("content", {})
                            .get("videoRenderer", {})
                        )
                        title_runs = video.get("title", {}).get("runs", [])
                        if title_runs:
                            videos.append({
                                "title": title_runs[0].get("text", ""),
                                "video_id": video.get("videoId", ""),
                            })
                    break
        except (KeyError, TypeError, IndexError):
            pass
        return videos

    def _extract_secondary_platforms(self, html):
        """Extract secondary platform names from external links."""
        platform_patterns = {
            "instagram": r"instagram\.com",
            "twitter": r"(twitter\.com|x\.com)",
            "tiktok": r"tiktok\.com",
            "facebook": r"facebook\.com",
            "twitch": r"twitch\.tv",
            "blog": r"(blog\.naver\.com|tistory\.com|brunch\.co\.kr)",
        }

        found = []
        for platform, pattern in platform_patterns.items():
            if re.search(pattern, html, re.IGNORECASE):
                found.append(platform)

        return found

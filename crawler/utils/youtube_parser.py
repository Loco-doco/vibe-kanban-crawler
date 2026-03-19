"""
YouTube-specific parsing utilities.

Shared subscriber_count extraction logic used by:
- scrapers/youtube.py (channel page scraping)
- scrapers/youtube_discovery.py (search result parsing)
- scrapers/email_finder.py (channel page visit during email search)
"""
import re
import json


def parse_subscriber_text(text):
    """Parse subscriber count text into an integer.

    Handles formats:
    - Korean: "구독자 1.2만명", "구독자 120명"
    - English: "1.2K subscribers", "1.2M", "500"
    - Plain: "1,234", "1234"

    Returns None if parsing fails.
    """
    if not text:
        return None
    text = text.replace(",", "").strip()

    # Korean format: "구독자 1.2만명", "1.2만"
    m = re.search(r"([\d.]+)\s*만", text)
    if m:
        try:
            return int(float(m.group(1)) * 10_000)
        except ValueError:
            pass

    # English/international multiplier suffixes
    multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
    for suffix, mult in multipliers.items():
        m = re.search(rf"([\d.]+)\s*{suffix}", text, re.IGNORECASE)
        if m:
            try:
                return int(float(m.group(1)) * mult)
            except ValueError:
                pass

    # Plain number
    m = re.search(r"([\d]+)", text)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass

    return None


def extract_subscriber_count(html):
    """Extract subscriber count from YouTube channel page HTML.

    Searches for subscriber count in:
    1. ytInitialData JSON (subscriberCountText)
    2. Raw HTML text patterns ("X subscribers")

    Returns int or None.
    """
    if not html:
        return None

    # Strategy 1: subscriberCountText in ytInitialData JSON
    match = re.search(
        r'"subscriberCountText"\s*:\s*\{[^}]*"simpleText"\s*:\s*"([^"]+)"', html
    )
    if match:
        result = parse_subscriber_text(match.group(1))
        if result is not None:
            return result

    # Strategy 2: Raw text pattern fallback
    match = re.search(r'([\d,.]+[KMB]?)\s*subscribers?', html, re.IGNORECASE)
    if match:
        result = parse_subscriber_text(match.group(1))
        if result is not None:
            return result

    return None


def extract_yt_initial_data(html):
    """Extract and parse ytInitialData JSON from YouTube HTML page.

    Returns parsed dict or None.
    """
    if not html:
        return None
    match = re.search(r"var ytInitialData\s*=\s*(\{.*?\});\s*</script>", html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None

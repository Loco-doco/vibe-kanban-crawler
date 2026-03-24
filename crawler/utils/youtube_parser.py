"""
YouTube-specific parsing utilities.

Shared subscriber_count extraction logic used by:
- scrapers/youtube.py (channel page scraping)
- scrapers/youtube_discovery.py (search result parsing)
- scrapers/email_finder.py (channel page visit during email search)
"""
import re
import json


def _trace(message):
    """Audience extraction trace — outputs as JSONL log message on stdout.
    Bridge.ex parses these as 'log' type and routes to Elixir Logger."""
    print(json.dumps({"type": "log", "message": f"[audience] {message}"}), flush=True)


def parse_subscriber_text(text):
    """Parse subscriber count text into an integer.

    Handles formats:
    - Korean: "구독자 1.2만명", "구독자 120명", "5.2천명", "1.3억명"
    - English: "1.2K subscribers", "1.2M", "500", "1.3B"
    - Plain: "1,234", "1234"
    - Mixed: "130만", "52.4만", "백만"

    Returns int or None.
    """
    if not text:
        return None
    text = text.replace(",", "").strip()

    # Korean 억 (100M)
    m = re.search(r"([\d.]+)\s*억", text)
    if m:
        try:
            return int(float(m.group(1)) * 100_000_000)
        except ValueError:
            pass

    # Korean 백만 (1M)
    m = re.search(r"([\d.]+)\s*백만", text)
    if m:
        try:
            return int(float(m.group(1)) * 1_000_000)
        except ValueError:
            pass

    # Korean 만 (10K)
    m = re.search(r"([\d.]+)\s*만", text)
    if m:
        try:
            return int(float(m.group(1)) * 10_000)
        except ValueError:
            pass

    # Korean 천 (1K)
    m = re.search(r"([\d.]+)\s*천", text)
    if m:
        try:
            return int(float(m.group(1)) * 1_000)
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

    # Plain number (including large numbers like 1234567)
    m = re.search(r"(\d+)", text)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass

    return None


def extract_subscriber_count(html):
    """Extract subscriber count from YouTube channel page HTML.

    Searches for subscriber count in multiple locations (in priority order):
    1. subscriberCountText in ytInitialData JSON (channel page)
    2. channelMetadataRenderer subscriberCount (structured data)
    3. Korean subscriber text patterns in page
    4. English subscriber text patterns in page
    5. meta tag og:description with subscriber info

    Returns int or None.
    """
    if not html:
        _trace("extract_subscriber_count: no HTML")
        return None

    # Strategy 1: subscriberCountText (primary, most reliable on channel pages)
    match = re.search(
        r'"subscriberCountText"\s*:\s*\{[^}]*"simpleText"\s*:\s*"([^"]+)"', html
    )
    if match:
        result = parse_subscriber_text(match.group(1))
        if result is not None:
            _trace(f"Strategy 1 (subscriberCountText.simpleText): '{match.group(1)}' → {result}")
            return result
        _trace(f"Strategy 1: found text '{match.group(1)}' but parse failed")

    # Strategy 1b: subscriberCountText with runs array
    match = re.search(
        r'"subscriberCountText"\s*:\s*\{[^}]*"runs"\s*:\s*\[(.*?)\]', html, re.DOTALL
    )
    if match:
        runs_text = "".join(re.findall(r'"text"\s*:\s*"([^"]*)"', match.group(1)))
        if runs_text:
            result = parse_subscriber_text(runs_text)
            if result is not None:
                _trace(f"Strategy 1b (subscriberCountText.runs): '{runs_text}' → {result}")
                return result

    # Strategy 2: channelMetadataRenderer (structured JSON in channel page)
    match = re.search(r'"channelMetadataRenderer"\s*:\s*\{[^}]*?"subscriberCount"\s*:\s*"?(\d+)"?', html)
    if match:
        try:
            result = int(match.group(1))
            _trace(f"Strategy 2 (channelMetadataRenderer.subscriberCount): {result}")
            return result
        except ValueError:
            pass

    # Strategy 3: Korean subscriber text in page body
    # Matches: "구독자 12.7만명", "구독자 130만", "구독자 5,200명"
    match = re.search(r'구독자\s*([\d,.]+\s*(?:억|백만|만|천)?)\s*명?', html)
    if match:
        result = parse_subscriber_text(match.group(1))
        if result is not None:
            _trace(f"Strategy 3 (Korean body text): '{match.group(1)}' → {result}")
            return result

    # Strategy 4: English subscriber text
    match = re.search(r'([\d,.]+[KMB]?)\s*subscribers?', html, re.IGNORECASE)
    if match:
        result = parse_subscriber_text(match.group(1))
        if result is not None:
            _trace(f"Strategy 4 (English body text): '{match.group(1)}' → {result}")
            return result

    # Strategy 5: microformat subscriberCount
    match = re.search(r'"microformat".*?"subscriberCount"\s*:\s*"?(\d+)"?', html, re.DOTALL)
    if match:
        try:
            result = int(match.group(1))
            _trace(f"Strategy 5 (microformat.subscriberCount): {result}")
            return result
        except ValueError:
            pass

    _trace("extract_subscriber_count: all strategies failed")
    return None


def classify_subscriber_failure(html):
    """Classify why subscriber count extraction failed.

    Returns one of:
    - fetch_failed: HTML was not retrieved
    - login_required: page requires login/age verification
    - page_structure_changed: ytInitialData not found
    - parse_failed: data present but parsing failed
    """
    if not html:
        return "fetch_failed"

    login_indicators = [
        "accounts.google.com/signin",
        "age-gate",
        "og:restrictions:age",
        "confirm your age",
    ]
    html_lower = html.lower()
    for indicator in login_indicators:
        if indicator.lower() in html_lower:
            return "login_required"

    yt_data = extract_yt_initial_data(html)
    if not yt_data:
        return "page_structure_changed"

    return "parse_failed"


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

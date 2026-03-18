"""
YouTube Discovery Scraper — keyword-based channel search.

Scrapes YouTube search results directly (no external library dependency),
then uses EmailFinder to search for emails across multiple sources.

Supports pagination via YouTube's InnerTube continuation API
to discover more channels per keyword.
"""
import re
import json
import time

import requests
from urllib.parse import quote_plus

from scrapers.base import BaseScraper
from scrapers.email_finder import EmailFinder
from utils.http_client import fetch_with_retry
from qa.email_validator import is_valid_email


def _log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)


def _error(message):
    print(json.dumps({"type": "error", "message": message}), flush=True)


def _parse_subscriber_text(text):
    """Parse subscriber count text like '구독자 1.2만명' or '1.2M subscribers' → int."""
    if not text:
        return None
    text = text.replace(",", "").strip()

    # Korean format: "구독자 1.2만명", "구독자 120명"
    m = re.search(r"([\d.]+)\s*만", text)
    if m:
        try:
            return int(float(m.group(1)) * 10_000)
        except ValueError:
            pass

    # English format: "1.2K", "1.2M"
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


def _extract_yt_initial_data(html):
    """Extract and parse ytInitialData JSON from YouTube HTML page."""
    match = re.search(r"var ytInitialData\s*=\s*(\{.*?\});\s*</script>", html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


class YouTubeDiscoveryScraper(BaseScraper):
    """Search YouTube channels by keyword via direct scraping, then find emails."""

    # YouTube search filter parameter for "Channel" type results
    CHANNEL_FILTER_PARAM = "EgIQAg%3D%3D"

    # Default InnerTube API key (public, used by YouTube web client)
    _DEFAULT_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"

    def scrape(self, query, subscriber_min=None, subscriber_max=None, remaining_target=None):
        """
        Generator: search YouTube channels by keyword,
        filter by subscriber range, then find emails using EmailFinder.

        Args:
            remaining_target: how many more qualified leads are needed.
                Controls search depth (more pages when close to target).
        """
        _log(f"Searching YouTube channels for: {query}")

        # Determine search depth based on remaining target
        max_pages = 1
        if remaining_target is not None:
            if remaining_target <= 5:
                max_pages = 3
            elif remaining_target <= 20:
                max_pages = 2

        channels = self._search_youtube(query, max_pages=max_pages)
        if not channels:
            _error(f"No channels found for: {query}")
            return

        _log(f"Found {len(channels)} channels for \"{query}\"")

        email_finder = EmailFinder({
            "max_retries": self.max_retries,
            "delay_ms": self.delay_ms,
            "max_depth": self.max_depth,
        })

        for ch in channels:
            channel_title = ch["title"]
            channel_url = ch["url"]
            channel_id = ch.get("channel_id", "")
            sub_count = ch.get("subscriber_count")
            description = ch.get("description", "")

            # Apply subscriber filter (skip channels only when we KNOW they're out of range)
            if sub_count is not None:
                if subscriber_min and sub_count < subscriber_min:
                    continue
                if subscriber_max and sub_count > subscriber_max:
                    continue

            if not channel_url:
                continue

            _log(f"Finding emails for: {channel_title} (subs: {sub_count})")

            # First, check if email is already in the search result description
            found_any = False
            found_emails = set()
            if description:
                desc_emails = re.findall(
                    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                    description,
                )
                for email in desc_emails:
                    if is_valid_email(email):
                        found_emails.add(email.lower())
                        found_any = True
                        yield {
                            "email": email,
                            "channel_name": channel_title,
                            "channel_url": channel_url,
                            "evidence_link": channel_url,
                            "confidence_score": 0.85,
                            "subscriber_count": sub_count,
                            "source": "youtube_search_desc",
                            "source_platform": "youtube",
                            "source_type": "search_result",
                            "source_url": channel_url,
                        }

            # Then use EmailFinder for deeper search
            for lead in email_finder.find_emails(channel_title, channel_url, channel_id):
                lead["channel_name"] = lead.get("channel_name") or channel_title
                lead["subscriber_count"] = lead.get("subscriber_count") or sub_count
                # Ensure source metadata defaults
                lead.setdefault("source_platform", "youtube")
                lead.setdefault("source_type", "profile_page")
                lead.setdefault("source_url", channel_url)
                # Skip if we already found this email from description
                if lead.get("email") and lead["email"].lower() in found_emails:
                    continue
                found_any = True
                yield lead

            # Even if no email found, yield channel info for manual review
            if not found_any:
                yield {
                    "email": None,
                    "channel_name": channel_title,
                    "channel_url": channel_url,
                    "evidence_link": channel_url,
                    "confidence_score": 0.3,
                    "subscriber_count": sub_count,
                    "source_platform": "youtube",
                    "source_type": "profile_page",
                    "source_url": channel_url,
                }

            # Respect delay between channels
            time.sleep(self.delay_ms / 1000)

    # ── YouTube Search with Pagination ──

    def _search_youtube(self, query, max_pages=1):
        """Search YouTube for channels, with pagination via continuation tokens."""
        encoded_query = quote_plus(query)
        search_url = (
            f"https://www.youtube.com/results"
            f"?search_query={encoded_query}"
            f"&sp={self.CHANNEL_FILTER_PARAM}"
        )

        # Page 1: regular HTML fetch
        html = fetch_with_retry(search_url, self.max_retries, self.delay_ms)
        if not html:
            _error("Failed to fetch YouTube search results page")
            return []

        data = _extract_yt_initial_data(html)
        if not data:
            _error("Failed to parse ytInitialData from YouTube search page")
            return []

        all_channels = []
        seen_urls = set()

        channels = self._parse_search_results(data)
        for ch in channels:
            if ch["url"] and ch["url"] not in seen_urls:
                seen_urls.add(ch["url"])
                all_channels.append(ch)

        _log(f"Page 1: {len(channels)} channels for \"{query}\"")

        # Pages 2+: use continuation tokens via InnerTube API
        if max_pages > 1:
            api_key = self._extract_api_key(html)
            continuation_token = self._extract_continuation_token(data)

            for page_num in range(2, max_pages + 1):
                if not continuation_token:
                    _log(f"No continuation token available, stopping pagination at page {page_num - 1}")
                    break

                time.sleep(self.delay_ms / 1000)

                next_data = self._fetch_continuation(api_key, continuation_token)
                if not next_data:
                    break

                channels = self._parse_continuation_results(next_data)
                new_count = 0
                for ch in channels:
                    if ch["url"] and ch["url"] not in seen_urls:
                        seen_urls.add(ch["url"])
                        all_channels.append(ch)
                        new_count += 1

                _log(f"Page {page_num}: {len(channels)} channels ({new_count} new)")

                if not channels:
                    break

                continuation_token = self._extract_continuation_token_from_response(next_data)

        return all_channels

    def _parse_search_results(self, data):
        """Extract channel info from parsed ytInitialData."""
        channels = []

        contents = (
            data
            .get("contents", {})
            .get("twoColumnSearchResultsRenderer", {})
            .get("primaryContents", {})
            .get("sectionListRenderer", {})
            .get("contents", [])
        )

        for section in contents:
            items = section.get("itemSectionRenderer", {}).get("contents", [])
            for item in items:
                ch = item.get("channelRenderer")
                if not ch:
                    continue
                parsed = self._parse_channel_renderer(ch)
                if parsed:
                    channels.append(parsed)

        return channels

    def _parse_continuation_results(self, data):
        """Parse channel results from InnerTube continuation API response."""
        channels = []

        actions = data.get("onResponseReceivedCommands", [])
        for action in actions:
            items = (
                action.get("appendContinuationItemsAction", {})
                .get("continuationItems", [])
            )
            for item in items:
                ch = item.get("channelRenderer")
                if not ch:
                    continue
                parsed = self._parse_channel_renderer(ch)
                if parsed:
                    channels.append(parsed)

        return channels

    def _parse_channel_renderer(self, ch):
        """Parse a single channelRenderer dict into our channel format."""
        title = ch.get("title", {}).get("simpleText", "")
        channel_id = ch.get("channelId", "")

        # Get channel URL (prefer canonical/vanity URL)
        url = ""
        nav = ch.get("navigationEndpoint", {}).get("browseEndpoint", {})
        canonical = nav.get("canonicalBaseUrl", "")
        if canonical:
            url = f"https://www.youtube.com{canonical}"
        elif channel_id:
            url = f"https://www.youtube.com/channel/{channel_id}"

        # Subscriber count (YouTube moved this to videoCountText in some layouts)
        sub_text = ""
        # Try subscriberCountText first
        sub_data = ch.get("subscriberCountText", {})
        if not sub_data:
            sub_data = ch.get("videoCountText", {})
        if "simpleText" in sub_data:
            sub_text = sub_data["simpleText"]
        elif "runs" in sub_data:
            sub_text = "".join(r.get("text", "") for r in sub_data["runs"])
        # Fallback: accessibility label
        if not sub_text:
            acc = sub_data.get("accessibility", {}).get("accessibilityData", {})
            sub_text = acc.get("label", "")

        # Description snippet
        desc = ""
        desc_snippet = ch.get("descriptionSnippet", {})
        if "runs" in desc_snippet:
            desc = "".join(r.get("text", "") for r in desc_snippet["runs"])

        if not title:
            return None

        return {
            "title": title,
            "channel_id": channel_id,
            "url": url,
            "subscriber_text": sub_text,
            "subscriber_count": _parse_subscriber_text(sub_text),
            "description": desc,
        }

    # ── Pagination Helpers ──

    def _extract_api_key(self, html):
        """Extract YouTube InnerTube API key from HTML page."""
        match = re.search(r'"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"', html)
        if match:
            return match.group(1)
        return self._DEFAULT_API_KEY

    def _extract_continuation_token(self, data):
        """Extract continuation token from ytInitialData search results."""
        contents = (
            data
            .get("contents", {})
            .get("twoColumnSearchResultsRenderer", {})
            .get("primaryContents", {})
            .get("sectionListRenderer", {})
            .get("contents", [])
        )

        for section in contents:
            # Check continuationItemRenderer at section level
            cont = section.get("continuationItemRenderer", {})
            token = (
                cont.get("continuationEndpoint", {})
                .get("continuationCommand", {})
                .get("token")
            )
            if token:
                return token

        return None

    def _extract_continuation_token_from_response(self, data):
        """Extract continuation token from InnerTube API continuation response."""
        actions = data.get("onResponseReceivedCommands", [])
        for action in actions:
            items = (
                action.get("appendContinuationItemsAction", {})
                .get("continuationItems", [])
            )
            for item in items:
                cont = item.get("continuationItemRenderer", {})
                token = (
                    cont.get("continuationEndpoint", {})
                    .get("continuationCommand", {})
                    .get("token")
                )
                if token:
                    return token
        return None

    def _fetch_continuation(self, api_key, continuation_token):
        """Fetch next page of YouTube search results via InnerTube continuation API."""
        url = f"https://www.youtube.com/youtubei/v1/search?key={api_key}"
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20241201.00.00",
                    "hl": "ko",
                    "gl": "KR",
                }
            },
            "continuation": continuation_token,
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Origin": "https://www.youtube.com",
            "Referer": "https://www.youtube.com/",
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            _log(f"Continuation API returned {resp.status_code}")
            return None
        except Exception as e:
            _log(f"Continuation request failed: {e}")
            return None

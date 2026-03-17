"""
YouTube Discovery Scraper — keyword-based channel search.

Uses youtubesearchpython to find YouTube channels by search keyword,
then uses EmailFinder to search for emails across multiple sources
(YouTube about page, web search, aggregator sites, creator websites).
"""
import time
import json

from scrapers.base import BaseScraper
from scrapers.email_finder import EmailFinder

try:
    from youtubesearchpython import ChannelsSearch
except ImportError:
    ChannelsSearch = None


def _log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)


def _parse_subscriber_text(text):
    """Parse subscriber count text like '1.2M subscribers' → 1200000."""
    if not text:
        return None
    text = text.replace(",", "").replace("subscribers", "").replace("subscriber", "").strip()
    multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
    for suffix, mult in multipliers.items():
        if text.upper().endswith(suffix):
            try:
                return int(float(text[:-1]) * mult)
            except ValueError:
                return None
    try:
        return int(float(text))
    except ValueError:
        return None


class YouTubeDiscoveryScraper(BaseScraper):
    """Search YouTube channels by keyword, then find emails via multi-source search."""

    def scrape(self, query, subscriber_min=None, subscriber_max=None):
        """
        Generator: search YouTube channels by keyword,
        filter by subscriber range, then find emails using EmailFinder.
        """
        if ChannelsSearch is None:
            print(
                '{"type": "error", "message": "youtubesearchpython not installed. Run: pip install youtubesearchpython"}',
                flush=True,
            )
            return

        _log(f"Searching YouTube channels for: {query}")

        try:
            search = ChannelsSearch(query, limit=40, region="KR", language="ko")
            results = search.result().get("result", [])
        except Exception as e:
            print(
                json.dumps({"type": "error", "message": f"YouTube search failed: {e}"}),
                flush=True,
            )
            return

        _log(f"Found {len(results)} channels for \"{query}\"")

        # EmailFinder uses multi-source strategy based on effort level (max_depth)
        email_finder = EmailFinder({
            "max_retries": self.max_retries,
            "delay_ms": self.delay_ms,
            "max_depth": self.max_depth,
        })

        for ch in results:
            channel_title = ch.get("title", "")
            channel_url = ch.get("link", "")
            channel_id = ch.get("id", "")
            sub_text = ch.get("subscribers", "")
            sub_count = _parse_subscriber_text(sub_text)

            # Apply subscriber filter (skip channels with unknown count when filter is set)
            if subscriber_min and (sub_count is None or sub_count < subscriber_min):
                continue
            if subscriber_max and (sub_count is None or sub_count > subscriber_max):
                continue

            if not channel_url:
                continue

            _log(f"Finding emails for: {channel_title} ({sub_text})")

            # Use EmailFinder for multi-source email search
            found_any = False
            for lead in email_finder.find_emails(channel_title, channel_url, channel_id):
                lead["channel_name"] = lead.get("channel_name") or channel_title
                lead["subscriber_count"] = lead.get("subscriber_count") or sub_count
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
                }

            # Respect delay between channels
            time.sleep(self.delay_ms / 1000)

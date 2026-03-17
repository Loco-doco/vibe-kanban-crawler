"""
Multi-source email finder for creators.

Instead of only looking within the creator's platform page,
searches across multiple sources to maximize email discovery rate.

Effort levels:
  1 (빠른 탐색): YouTube about page only
  2 (표준 탐색): YouTube about + external links + web search
  3 (심층 탐색): All above + aggregator sites + creator website deep scan
"""
import re
import json
import time

from urllib.parse import quote_plus, urlparse, unquote

from utils.http_client import fetch_with_retry
from utils.parser import extract_emails_from_html, extract_links
from qa.email_validator import is_valid_email


def _log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)


class EmailFinder:
    """Orchestrates multiple email search strategies per effort level."""

    EFFORT_STRATEGIES = {
        1: ["youtube_about"],
        2: ["youtube_about", "youtube_links", "web_search"],
        3: ["youtube_about", "youtube_links", "web_search", "aggregators", "website_deep"],
    }

    def __init__(self, config):
        self.max_retries = config.get("max_retries", 3)
        self.delay_ms = config.get("delay_ms", 2000)
        self.effort = min(max(config.get("max_depth", 2), 1), 3)

    def find_emails(self, channel_name, channel_url, channel_id=None):
        """
        Generator yielding email lead dicts from multiple sources.
        Deduplicates across sources automatically.
        """
        strategies = self.EFFORT_STRATEGIES.get(self.effort, self.EFFORT_STRATEGIES[2])
        seen_emails = set()

        # Pre-fetch about page (shared by youtube_about and youtube_links)
        about_url = channel_url.rstrip("/") + "/about"
        about_html = fetch_with_retry(about_url, self.max_retries, self.delay_ms)

        ctx = {
            "about_html": about_html,
            "about_url": about_url,
            "channel_id": channel_id or self._extract_channel_id(channel_url, about_html),
        }

        for strategy_name in strategies:
            method = getattr(self, f"_search_{strategy_name}", None)
            if not method:
                continue

            try:
                for lead in method(channel_name, channel_url, ctx):
                    email_lower = lead["email"].lower()
                    if email_lower not in seen_emails:
                        seen_emails.add(email_lower)
                        yield lead
            except Exception as e:
                _log(f"[{strategy_name}] Error for {channel_name}: {e}")

            # Brief pause between strategies to avoid rate limiting
            if strategy_name != strategies[-1]:
                time.sleep(self.delay_ms / 1000 * 0.3)

    # ── Strategy: YouTube About Page ──

    def _search_youtube_about(self, channel_name, channel_url, ctx):
        html = ctx["about_html"]
        if not html:
            return

        # Extract from page text
        emails = extract_emails_from_html(html)
        for email in emails:
            if is_valid_email(email):
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": ctx["about_url"],
                    "confidence_score": 0.8,
                    "source": "youtube_about",
                }

        # Extract from ytInitialData JSON blob
        for match in re.finditer(
            r"var ytInitialData\s*=\s*(\{.+?\});\s*</script>", html, re.DOTALL
        ):
            data_str = match.group(1)
            for email in set(
                re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", data_str)
            ):
                if is_valid_email(email):
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": ctx["about_url"],
                        "confidence_score": 0.75,
                        "source": "youtube_data",
                    }

    # ── Strategy: YouTube External Links ──

    def _search_youtube_links(self, channel_name, channel_url, ctx):
        html = ctx["about_html"]
        if not html:
            return

        external_links = self._extract_youtube_external_links(html)
        for link in external_links[:5]:
            link_html = fetch_with_retry(link, self.max_retries, self.delay_ms)
            if not link_html:
                continue

            emails = extract_emails_from_html(link_html)
            for email in emails:
                if is_valid_email(email):
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": link,
                        "confidence_score": 0.6,
                        "source": "youtube_link",
                    }

    # ── Strategy: Web Search ──

    def _search_web_search(self, channel_name, channel_url, ctx):
        _log(f"[web_search] Searching web for: {channel_name}")

        queries = [
            f'"{channel_name}" email contact',
            f'"{channel_name}" 이메일 연락처',
        ]

        for query in queries:
            result_urls = self._duckduckgo_search(query)

            for result_url in result_urls[:3]:
                # Skip YouTube itself (already searched)
                parsed = urlparse(result_url)
                if "youtube.com" in parsed.netloc or "youtu.be" in parsed.netloc:
                    continue

                html = fetch_with_retry(result_url, self.max_retries, self.delay_ms)
                if not html:
                    continue

                emails = extract_emails_from_html(html)
                for email in emails:
                    if is_valid_email(email):
                        yield {
                            "email": email,
                            "channel_name": channel_name,
                            "channel_url": channel_url,
                            "evidence_link": result_url,
                            "confidence_score": 0.7,
                            "source": "web_search",
                        }

    # ── Strategy: Aggregator Sites ──

    def _search_aggregators(self, channel_name, channel_url, ctx):
        channel_id = ctx.get("channel_id")
        if not channel_id:
            return

        _log(f"[aggregators] Checking aggregator sites for: {channel_name}")

        # Playboard
        playboard_url = f"https://playboard.co/en/channel/{channel_id}"
        html = fetch_with_retry(playboard_url, self.max_retries, self.delay_ms)
        if html:
            emails = extract_emails_from_html(html)
            for email in emails:
                if is_valid_email(email):
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": playboard_url,
                        "confidence_score": 0.65,
                        "source": "playboard",
                    }

    # ── Strategy: Creator Website Deep Scan ──

    def _search_website_deep(self, channel_name, channel_url, ctx):
        html = ctx["about_html"]
        if not html:
            return

        external_links = self._extract_youtube_external_links(html)

        # Filter out social media — find the creator's own website
        social_domains = {
            "twitter.com", "x.com", "instagram.com", "facebook.com",
            "tiktok.com", "twitch.tv", "discord.gg", "discord.com",
            "threads.net", "linkedin.com",
        }

        own_sites = []
        for link in external_links:
            domain = urlparse(link).netloc.lower()
            if not any(sd in domain for sd in social_domains):
                own_sites.append(link)

        if not own_sites:
            return

        _log(f"[website_deep] Scanning creator websites for: {channel_name}")

        contact_patterns = re.compile(
            r"(contact|about|team|impressum|connect|reach|email|문의|연락|소개)",
            re.IGNORECASE,
        )

        for site_url in own_sites[:2]:
            site_html = fetch_with_retry(site_url, self.max_retries, self.delay_ms)
            if not site_html:
                continue

            # Extract emails from main page
            emails = extract_emails_from_html(site_html)
            for email in emails:
                if is_valid_email(email):
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": site_url,
                        "confidence_score": 0.7,
                        "source": "creator_website",
                    }

            # Follow contact/about pages on the creator's site
            all_links = extract_links(site_html, site_url)
            site_domain = urlparse(site_url).netloc.lower()

            for link in all_links:
                link_domain = urlparse(link).netloc.lower()
                if link_domain != site_domain:
                    continue
                if not contact_patterns.search(link):
                    continue

                contact_html = fetch_with_retry(link, self.max_retries, self.delay_ms)
                if not contact_html:
                    continue

                emails = extract_emails_from_html(contact_html)
                for email in emails:
                    if is_valid_email(email):
                        yield {
                            "email": email,
                            "channel_name": channel_name,
                            "channel_url": channel_url,
                            "evidence_link": link,
                            "confidence_score": 0.7,
                            "source": "creator_website",
                        }

    # ── Helpers ──

    def _duckduckgo_search(self, query):
        """Search DuckDuckGo HTML and return result URLs."""
        search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        html = fetch_with_retry(search_url, self.max_retries, self.delay_ms)
        if not html:
            return []

        urls = []
        from bs4 import BeautifulSoup
        from urllib.parse import parse_qs, urlparse as _urlparse

        soup = BeautifulSoup(html, "lxml")

        for link in soup.select("a.result__a"):
            href = link.get("href", "")
            if "duckduckgo.com/l/" in href:
                # Extract actual URL from redirect
                params = parse_qs(_urlparse(href).query)
                if "uddg" in params:
                    urls.append(params["uddg"][0])
            elif href.startswith("http"):
                urls.append(href)

        return urls[:5]

    def _extract_youtube_external_links(self, html):
        """Extract external links from YouTube channel page."""
        links = []

        for match in re.finditer(r'q=https?%3A%2F%2F([^"&]+)', html):
            decoded = unquote("https://" + match.group(1))
            links.append(decoded)

        for match in re.finditer(
            r'"url"\s*:\s*"(https?://(?!www\.youtube\.com)[^"]+)"', html
        ):
            links.append(match.group(1))

        return list(set(links))

    def _extract_channel_id(self, channel_url, html=None):
        """Extract YouTube channel ID from URL or page HTML."""
        match = re.search(r"/channel/(UC[a-zA-Z0-9_-]+)", channel_url)
        if match:
            return match.group(1)

        if html:
            match = re.search(r'"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"', html)
            if match:
                return match.group(1)

        return None

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
from utils.youtube_parser import extract_subscriber_count
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
        # Set by find_emails — caller can read after iteration to get channel page subscriber count
        self.last_subscriber_count = None

    def find_emails(self, channel_name, channel_url, channel_id=None):
        """
        Generator yielding email lead dicts from multiple sources.
        Deduplicates across sources automatically.
        After iteration, self.last_subscriber_count contains the channel page's subscriber count.
        """
        strategies = self.EFFORT_STRATEGIES.get(self.effort, self.EFFORT_STRATEGIES[2])
        seen_emails = set()

        # Fetch channel main page (YouTube deprecated /about as separate URL)
        channel_page_url = channel_url.rstrip("/")
        channel_html = fetch_with_retry(channel_page_url, self.max_retries, self.delay_ms)

        # Extract subscriber_count from channel page HTML
        channel_subscriber_count = extract_subscriber_count(channel_html) if channel_html else None
        self.last_subscriber_count = channel_subscriber_count

        ctx = {
            "about_html": channel_html,
            "about_url": channel_page_url,
            "channel_id": channel_id or self._extract_channel_id(channel_url, channel_html),
            "subscriber_count": channel_subscriber_count,
        }

        for strategy_name in strategies:
            method = getattr(self, f"_search_{strategy_name}", None)
            if not method:
                continue

            try:
                for lead in method(channel_name, channel_url, ctx):
                    # Propagate subscriber_count to all leads
                    lead.setdefault("subscriber_count", ctx.get("subscriber_count"))
                    email_lower = lead["email"].lower()
                    if email_lower not in seen_emails:
                        seen_emails.add(email_lower)
                        yield lead
            except Exception as e:
                _log(f"[{strategy_name}] Error for {channel_name}: {e}")

            # Brief pause between strategies to avoid rate limiting
            if strategy_name != strategies[-1]:
                time.sleep(self.delay_ms / 1000 * 0.3)

    # ── Strategy: YouTube Channel Page ──

    def _search_youtube_about(self, channel_name, channel_url, ctx):
        html = ctx["about_html"]
        if not html:
            return

        # Strategy 1: Extract from visible page text
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
                    "source_platform": "youtube",
                    "source_type": "profile_page",
                    "source_url": ctx["about_url"],
                }

        # Strategy 2: Parse ytInitialData for channel description (most reliable)
        found_from_description = False
        match = re.search(
            r"var ytInitialData\s*=\s*(\{.*?\});\s*</script>", html, re.DOTALL
        )
        if match:
            try:
                data = json.loads(match.group(1))

                # Extract channel description from metadata
                description = (
                    data
                    .get("metadata", {})
                    .get("channelMetadataRenderer", {})
                    .get("description", "")
                )
                if description:
                    for email in set(
                        re.findall(
                            r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                            description,
                        )
                    ):
                        if is_valid_email(email):
                            found_from_description = True
                            yield {
                                "email": email,
                                "channel_name": channel_name,
                                "channel_url": channel_url,
                                "evidence_link": ctx["about_url"],
                                "confidence_score": 0.85,
                                "source": "youtube_description",
                                "source_platform": "youtube",
                                "source_type": "about_page",
                                "source_url": ctx["about_url"],
                            }

            except json.JSONDecodeError:
                pass

            # Strategy 3: Broad email scan across ytInitialData (fallback only)
            # Only if structured description parsing found nothing
            if not found_from_description:
                data_str = match.group(1)
                for email in set(
                    re.findall(
                        r"(?<![a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                        data_str,
                    )
                ):
                    if is_valid_email(email):
                        yield {
                            "email": email,
                            "channel_name": channel_name,
                            "channel_url": channel_url,
                            "evidence_link": ctx["about_url"],
                            "confidence_score": 0.75,
                            "source": "youtube_data",
                            "source_platform": "youtube",
                            "source_type": "profile_page",
                            "source_url": ctx["about_url"],
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
                        "source_platform": "website",
                        "source_type": "external_site",
                        "source_url": link,
                    }

    # ── Strategy: Web Search ──

    # Track persistent DDG failures to avoid wasting time on subsequent channels
    _ddg_blocked = False

    def _search_web_search(self, channel_name, channel_url, ctx):
        if self._ddg_blocked:
            return

        _log(f"[web_search] Searching web for: {channel_name}")

        queries = [
            f'"{channel_name}" email contact',
            f'"{channel_name}" 이메일 연락처',
        ]

        for query in queries:
            result_urls = self._duckduckgo_search(query)
            if result_urls is None:
                # DDG is blocked, skip all remaining web searches
                EmailFinder._ddg_blocked = True
                _log("[web_search] DuckDuckGo appears blocked, skipping web search for remaining channels")
                return

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
                            "source_platform": "website",
                            "source_type": "external_site",
                            "source_url": result_url,
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
                        "source_platform": "website",
                        "source_type": "external_site",
                        "source_url": playboard_url,
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
                        "source_platform": "website",
                        "source_type": "profile_page",
                        "source_url": site_url,
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
                            "source_platform": "website",
                            "source_type": "contact_page",
                            "source_url": link,
                        }

    # ── Helpers ──

    def _duckduckgo_search(self, query):
        """Search DuckDuckGo and return result URLs.
        Returns None if DDG appears blocked (403), [] if no results, or list of URLs.
        Uses short timeout to avoid blocking the pipeline."""
        import requests as _requests

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        }

        # Strategy 1: DuckDuckGo Lite (less aggressive blocking)
        try:
            resp = _requests.get(
                f"https://lite.duckduckgo.com/lite/?q={quote_plus(query)}",
                headers=headers, timeout=8,
            )
            if resp.status_code == 403:
                return None  # signal: DDG is blocking us

            if resp.status_code == 200 and resp.text:
                import re as _re
                from urllib.parse import urlparse as _urlparse
                urls = []
                for match in _re.finditer(r'href="(https?://(?!lite\.duckduckgo|duckduckgo)[^"]+)"', resp.text):
                    parsed = _urlparse(match.group(1))
                    if 'duckduckgo' not in parsed.netloc:
                        urls.append(match.group(1))
                if urls:
                    return urls[:5]
        except _requests.Timeout:
            return None  # treat timeout as blocked
        except Exception:
            pass

        # Strategy 2: DuckDuckGo HTML (fallback)
        try:
            resp = _requests.get(
                f"https://html.duckduckgo.com/html/?q={quote_plus(query)}",
                headers=headers, timeout=8,
            )
            if resp.status_code == 403:
                return None

            if resp.status_code == 200 and resp.text:
                from bs4 import BeautifulSoup
                from urllib.parse import parse_qs, urlparse as _urlparse
                soup = BeautifulSoup(resp.text, "lxml")
                urls = []
                for link in soup.select("a.result__a"):
                    href = link.get("href", "")
                    if "duckduckgo.com/l/" in href:
                        params = parse_qs(_urlparse(href).query)
                        if "uddg" in params:
                            urls.append(params["uddg"][0])
                    elif href.startswith("http"):
                        urls.append(href)
                return urls[:5]
        except _requests.Timeout:
            return None
        except Exception:
            pass

        return []

    # Domains that are YouTube/Google internal — not creator-owned
    _INTERNAL_DOMAINS = {
        "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
        "googlevideo.com", "ytimg.com", "ggpht.com", "gstatic.com",
        "google.com", "googleapis.com", "accounts.google.com",
        "googleusercontent.com", "googleadservices.com",
        "play.google.com", "support.google.com",
    }

    def _extract_youtube_external_links(self, html):
        """Extract external links from YouTube channel page (skip YouTube/Google internal URLs)."""
        links = []

        for match in re.finditer(r'q=https?%3A%2F%2F([^"&]+)', html):
            decoded = unquote("https://" + match.group(1))
            links.append(decoded)

        for match in re.finditer(
            r'"url"\s*:\s*"(https?://(?!www\.youtube\.com)[^"]+)"', html
        ):
            links.append(match.group(1))

        # Filter out YouTube/Google internal domains
        filtered = []
        for link in set(links):
            domain = urlparse(link).netloc.lower()
            if not any(domain.endswith(internal) for internal in self._INTERNAL_DOMAINS):
                filtered.append(link)

        return filtered

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

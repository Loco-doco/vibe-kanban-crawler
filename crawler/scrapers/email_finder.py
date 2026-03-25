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
        2: ["youtube_about", "youtube_links", "social_profiles", "web_search"],
        3: ["youtube_about", "youtube_links", "social_profiles", "web_search", "aggregators", "website_deep"],
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

        # Strategy 2: Parse ytInitialData for channel description + business email
        found_from_description = False
        match = re.search(
            r"var ytInitialData\s*=\s*(\{.*?\});\s*</script>", html, re.DOTALL
        )
        if match:
            data_str = match.group(1)
            try:
                data = json.loads(data_str)

                # 2a: channelMetadataRenderer.description (classic)
                description = (
                    data
                    .get("metadata", {})
                    .get("channelMetadataRenderer", {})
                    .get("description", "")
                )

                # 2b: Also try aboutChannelViewModel (newer YouTube structure)
                # and signInForBusinessEmail / businessEmailLabel
                about_texts = [description] if description else []

                # Deep scan for any "description" or "aboutChannelViewModel" text
                about_match = re.search(r'"aboutChannelViewModel"\s*:\s*\{(.*?)\}', data_str, re.DOTALL)
                if about_match:
                    about_texts.append(about_match.group(1))

                # businessEmailRevealRenderer has email behind a click, but
                # the email is sometimes in signInForBusinessEmail text
                biz_match = re.search(r'"businessEmail(?:Label|Reveal).*?"text"\s*:\s*"([^"]+)"', data_str)
                if biz_match:
                    about_texts.append(biz_match.group(1))

                all_text = " ".join(about_texts)
                if all_text:
                    for email in set(
                        re.findall(
                            r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                            all_text,
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
            if not found_from_description:
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

    # ── Strategy: Social Profile Scanning ──

    # Social platforms where creators often put contact emails
    _SOCIAL_EXTRACTORS = {
        "instagram.com": "_extract_email_from_instagram",
        "blog.naver.com": "_extract_email_from_naver_blog",
        "naver.me": "_extract_email_from_naver_blog",
        "x.com": "_extract_email_from_twitter",
        "twitter.com": "_extract_email_from_twitter",
        "linktr.ee": "_extract_email_from_linktree",
        "lit.link": "_extract_email_from_linktree",
        "lnk.to": "_extract_email_from_linktree",
    }

    def _search_social_profiles(self, channel_name, channel_url, ctx):
        """Visit social profile links from YouTube channel and extract emails."""
        html = ctx["about_html"]
        if not html:
            return

        external_links = self._extract_youtube_external_links(html)
        if not external_links:
            return

        visited = 0
        for link in external_links:
            if visited >= 3:  # Limit to 3 social profiles
                break

            domain = urlparse(link).netloc.lower()

            # Check if this is a known social platform
            extractor_name = None
            for social_domain, method_name in self._SOCIAL_EXTRACTORS.items():
                if social_domain in domain:
                    extractor_name = method_name
                    break

            if not extractor_name:
                # Also try generic extraction for unknown social/link pages
                if any(d in domain for d in ['blog', 'notion.', 'carrd.co', 'bio.link', 'beacons.ai']):
                    extractor_name = "_extract_email_generic"

            if not extractor_name:
                continue

            visited += 1
            _log(f"[social] Scanning {domain} for: {channel_name}")

            extractor = getattr(self, extractor_name, self._extract_email_generic)
            try:
                for lead in extractor(link, channel_name, channel_url):
                    yield lead
            except Exception as e:
                _log(f"[social] Error scanning {link}: {e}")

            time.sleep(self.delay_ms / 1000 * 0.3)

    def _extract_email_from_instagram(self, url, channel_name, channel_url):
        """Extract email from Instagram profile page."""
        html = fetch_with_retry(url, 1, self.delay_ms)
        if not html:
            return

        # Instagram embeds profile data in shared_data or meta tags
        emails = set(re.findall(
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            html,
        ))
        for email in emails:
            if is_valid_email(email):
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": url,
                    "confidence_score": 0.7,
                    "source": "instagram_profile",
                    "source_platform": "instagram",
                    "source_type": "profile_page",
                    "source_url": url,
                }

    def _extract_email_from_naver_blog(self, url, channel_name, channel_url):
        """Extract email from Naver blog profile/about page."""
        # Naver blog profile URL patterns
        profile_urls = [url]

        # If it's a blog URL, also try the profile page
        match = re.search(r'blog\.naver\.com/([^/?#]+)', url)
        if match:
            blog_id = match.group(1)
            profile_urls.append(f"https://blog.naver.com/prologue/PrologueList.naver?blogId={blog_id}")

        for page_url in profile_urls:
            html = fetch_with_retry(page_url, 1, self.delay_ms)
            if not html:
                continue

            emails = set(re.findall(
                r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                html,
            ))
            for email in emails:
                if is_valid_email(email):
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": page_url,
                        "confidence_score": 0.7,
                        "source": "naver_blog",
                        "source_platform": "naver",
                        "source_type": "profile_page",
                        "source_url": page_url,
                    }

    def _extract_email_from_twitter(self, url, channel_name, channel_url):
        """Extract email from Twitter/X profile — limited since most is JS-rendered."""
        html = fetch_with_retry(url, 1, self.delay_ms)
        if not html:
            return

        # Twitter bio is sometimes in meta tags
        emails = set(re.findall(
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            html,
        ))
        for email in emails:
            if is_valid_email(email):
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": url,
                    "confidence_score": 0.6,
                    "source": "twitter_profile",
                    "source_platform": "twitter",
                    "source_type": "profile_page",
                    "source_url": url,
                }

    def _extract_email_from_linktree(self, url, channel_name, channel_url):
        """Extract email from Linktree, lit.link, and similar bio link pages."""
        html = fetch_with_retry(url, 1, self.delay_ms)
        if not html:
            return

        emails = set(re.findall(
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            html,
        ))
        # Also check for mailto: links
        emails |= set(re.findall(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html))

        for email in emails:
            if is_valid_email(email):
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": url,
                    "confidence_score": 0.75,
                    "source": "linktree",
                    "source_platform": "website",
                    "source_type": "bio_link",
                    "source_url": url,
                }

    def _extract_email_generic(self, url, channel_name, channel_url):
        """Generic email extraction from any external page."""
        html = fetch_with_retry(url, 1, self.delay_ms)
        if not html:
            return

        emails = set(re.findall(
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            html,
        ))
        emails |= set(re.findall(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html))

        for email in emails:
            if is_valid_email(email):
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": url,
                    "confidence_score": 0.65,
                    "source": "social_link",
                    "source_platform": "website",
                    "source_type": "external_site",
                    "source_url": url,
                }

    # ── Strategy: Web Search ──

    def _search_web_search(self, channel_name, channel_url, ctx):
        _log(f"[web_search] Searching web for: {channel_name}")

        queries = [
            f'"{channel_name}" email contact',
            f'"{channel_name}" 이메일 연락처',
        ]

        for query in queries:
            result_urls = self._multi_engine_search(query)
            if not result_urls:
                continue

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

    # Track which search engines are blocked to avoid repeated timeouts
    _blocked_engines = set()

    def _multi_engine_search(self, query):
        """Try multiple search engines in order. Returns list of URLs or []."""
        engines = [
            ("google", self._google_search),
            ("duckduckgo", self._duckduckgo_search),
        ]
        for name, search_fn in engines:
            if name in EmailFinder._blocked_engines:
                continue
            result = search_fn(query)
            if result is None:
                # Engine is blocked
                EmailFinder._blocked_engines.add(name)
                _log(f"[web_search] {name} appears blocked, trying next engine")
                continue
            if result:
                return result
        return []

    def _google_search(self, query):
        """Search Google and return result URLs.
        Returns None if blocked, [] if no results."""
        import requests as _requests

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        }

        try:
            resp = _requests.get(
                f"https://www.google.com/search?q={quote_plus(query)}&num=5&hl=ko",
                headers=headers, timeout=8,
            )
            if resp.status_code == 429 or resp.status_code == 403:
                return None
            if resp.status_code == 200 and resp.text:
                import re as _re
                urls = []
                # Extract URLs from Google search results
                for match in _re.finditer(r'href="(https?://(?!www\.google|google\.com|accounts\.google)[^"&]+)"', resp.text):
                    url = match.group(1)
                    if not any(d in url for d in ['google.com', 'googleapis.com', 'gstatic.com', 'youtube.com']):
                        urls.append(url)
                return urls[:5] if urls else []
        except _requests.Timeout:
            return None
        except Exception:
            pass
        return []

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

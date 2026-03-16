import re
import json
from urllib.parse import urlparse, urljoin

from scrapers.base import BaseScraper
from utils.http_client import fetch_with_retry
from utils.parser import extract_emails_from_html, extract_links, extract_meta_content
from qa.email_validator import is_valid_email


class YouTubeScraper(BaseScraper):
    """Rule-based scraper for YouTube channels."""

    def scrape(self, url):
        about_url = self._normalize_to_about(url)
        channel_url = self._normalize_channel_url(url)

        html = fetch_with_retry(about_url, self.max_retries, self.delay_ms)
        if not html:
            return

        channel_name = self._extract_channel_name(html)
        subscriber_count = self._extract_subscriber_count(html)

        # Extract emails from about page
        emails = extract_emails_from_html(html)
        seen_emails = set()

        for email in emails:
            if is_valid_email(email) and email.lower() not in seen_emails:
                seen_emails.add(email.lower())
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": about_url,
                    "confidence_score": 0.8,
                    "subscriber_count": subscriber_count,
                }

        # Also try to extract from ytInitialData JSON blob
        for lead in self._extract_from_initial_data(html, channel_url, channel_name, subscriber_count):
            if lead["email"].lower() not in seen_emails:
                seen_emails.add(lead["email"].lower())
                yield lead

        # Follow external links (depth 2)
        if self.max_depth > 1:
            external_links = self._extract_external_links(html)
            for link in external_links[:5]:
                yield from self._scrape_linked(link, channel_url, channel_name, seen_emails)

    def _normalize_to_about(self, url):
        url = url.rstrip("/")
        if "/about" not in url:
            url = url + "/about"
        return url

    def _normalize_channel_url(self, url):
        url = url.rstrip("/")
        for suffix in ["/about", "/videos", "/playlists", "/community", "/channels"]:
            if url.endswith(suffix):
                url = url[: -len(suffix)]
        return url

    def _extract_channel_name(self, html):
        match = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html)
        if match:
            return match.group(1)
        match = re.search(r'"channelName"\s*:\s*"([^"]+)"', html)
        if match:
            return match.group(1)
        return None

    def _extract_subscriber_count(self, html):
        match = re.search(r'"subscriberCountText"\s*:\s*\{[^}]*"simpleText"\s*:\s*"([^"]+)"', html)
        if match:
            return self._parse_count(match.group(1))
        match = re.search(r'([\d,.]+[KMB]?)\s*subscribers?', html, re.IGNORECASE)
        if match:
            return self._parse_count(match.group(1))
        return None

    def _parse_count(self, text):
        text = text.replace(",", "").strip()
        multipliers = {"K": 1000, "M": 1000000, "B": 1000000000}
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

    def _extract_from_initial_data(self, html, channel_url, channel_name, subscriber_count):
        """Try to extract emails from ytInitialData JSON embedded in page."""
        match = re.search(r"var ytInitialData\s*=\s*(\{.+?\});\s*</script>", html, re.DOTALL)
        if not match:
            return

        try:
            data_str = match.group(1)
            # Extract emails from the JSON string directly
            emails = set(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", data_str))
            for email in emails:
                if is_valid_email(email):
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": channel_url + "/about",
                        "confidence_score": 0.75,
                        "subscriber_count": subscriber_count,
                    }
        except Exception:
            pass

    def _extract_external_links(self, html):
        """Extract links from YouTube channel's 'Links' section."""
        links = []
        # Look for redirect links in YouTube's format
        for match in re.finditer(r'q=https?%3A%2F%2F([^"&]+)', html):
            from urllib.parse import unquote
            decoded = unquote("https://" + match.group(1))
            links.append(decoded)

        # Also look for direct external links
        for match in re.finditer(r'"url"\s*:\s*"(https?://(?!www\.youtube\.com)[^"]+)"', html):
            links.append(match.group(1))

        return list(set(links))[:5]

    def _scrape_linked(self, linked_url, channel_url, channel_name, seen_emails):
        html = fetch_with_retry(linked_url, self.max_retries, self.delay_ms)
        if not html:
            return

        emails = extract_emails_from_html(html)
        for email in emails:
            if is_valid_email(email) and email.lower() not in seen_emails:
                seen_emails.add(email.lower())
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": linked_url,
                    "confidence_score": 0.6,
                    "subscriber_count": None,
                }

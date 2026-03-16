import re
import json
from urllib.parse import urlparse

from scrapers.base import BaseScraper
from utils.http_client import fetch_with_retry
from utils.parser import extract_emails_from_html, extract_meta_content
from qa.email_validator import is_valid_email


class InstagramScraper(BaseScraper):
    """
    Rule-based scraper for Instagram profiles.
    Note: Instagram aggressively blocks scraping. This works on publicly
    accessible data only. Success rate is limited without browser automation.
    """

    def scrape(self, url):
        url = self._normalize_url(url)
        html = fetch_with_retry(url, self.max_retries, self.delay_ms)
        if not html:
            return

        channel_name = self._extract_username(url)
        channel_url = url

        # Try to extract from page source (meta tags, JSON-LD)
        emails = extract_emails_from_html(html)
        seen_emails = set()

        for email in emails:
            if is_valid_email(email) and email.lower() not in seen_emails:
                seen_emails.add(email.lower())
                yield {
                    "email": email,
                    "channel_name": channel_name,
                    "channel_url": channel_url,
                    "evidence_link": url,
                    "confidence_score": 0.7,
                    "subscriber_count": self._extract_follower_count(html),
                }

        # Try to extract from og:description (bio text)
        bio = extract_meta_content(html, "og:description")
        if bio:
            bio_emails = set(re.findall(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", bio
            ))
            for email in bio_emails:
                if is_valid_email(email) and email.lower() not in seen_emails:
                    seen_emails.add(email.lower())
                    yield {
                        "email": email,
                        "channel_name": channel_name,
                        "channel_url": channel_url,
                        "evidence_link": url,
                        "confidence_score": 0.75,
                        "subscriber_count": None,
                    }

        # Follow link-in-bio if present
        if self.max_depth > 1:
            external_url = self._extract_external_url(html)
            if external_url:
                yield from self._scrape_linked(external_url, channel_url, channel_name, seen_emails)

    def _normalize_url(self, url):
        url = url.rstrip("/")
        if not url.startswith("http"):
            url = "https://www.instagram.com/" + url.lstrip("/")
        return url

    def _extract_username(self, url):
        path = urlparse(url).path.strip("/")
        return path.split("/")[0] if path else None

    def _extract_follower_count(self, html):
        match = re.search(r'([\d,.]+)\s*Followers', html, re.IGNORECASE)
        if match:
            text = match.group(1).replace(",", "")
            try:
                return int(float(text))
            except ValueError:
                return None
        return None

    def _extract_external_url(self, html):
        """Extract the link-in-bio URL from Instagram page."""
        # Check og:description or page source for external links
        match = re.search(r'"external_url"\s*:\s*"(https?://[^"]+)"', html)
        if match:
            return match.group(1)
        # Look in meta tags
        match = re.search(r'rel="me"\s+href="(https?://[^"]+)"', html)
        if match:
            return match.group(1)
        return None

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

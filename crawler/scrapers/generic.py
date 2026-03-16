import re
from urllib.parse import urlparse, urljoin

from scrapers.base import BaseScraper
from utils.http_client import fetch_with_retry
from utils.parser import extract_emails_from_html, extract_links
from qa.email_validator import is_valid_email

CONTACT_PATTERNS = re.compile(
    r"(contact|about|team|impressum|connect|reach|email)",
    re.IGNORECASE,
)


class GenericScraper(BaseScraper):
    """Heuristic scraper for arbitrary URLs. BFS up to max_depth."""

    def scrape(self, url):
        visited = set()
        to_visit = [(url, 0)]
        base_domain = urlparse(url).netloc.lower()

        while to_visit:
            current_url, depth = to_visit.pop(0)

            if current_url in visited or depth > self.max_depth:
                continue
            visited.add(current_url)

            html = fetch_with_retry(current_url, self.max_retries, self.delay_ms)
            if not html:
                continue

            emails = extract_emails_from_html(html)
            for email in emails:
                if is_valid_email(email):
                    confidence = 0.5
                    if "/about" in current_url or "/contact" in current_url:
                        confidence = 0.7
                    yield {
                        "email": email,
                        "channel_name": None,
                        "channel_url": url,
                        "evidence_link": current_url,
                        "confidence_score": confidence,
                        "subscriber_count": None,
                    }

            # Find contact-relevant links to follow
            if depth < self.max_depth:
                all_links = extract_links(html, current_url)
                for link in all_links:
                    link_domain = urlparse(link).netloc.lower()
                    if link_domain != base_domain:
                        continue
                    if link in visited:
                        continue
                    if CONTACT_PATTERNS.search(link):
                        to_visit.append((link, depth + 1))

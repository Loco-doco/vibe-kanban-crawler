import re
from bs4 import BeautifulSoup

EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)


def extract_emails_from_html(html):
    """Extract all email addresses from HTML, removing script/style noise."""
    soup = BeautifulSoup(html, "lxml")

    # Remove script and style tags
    for tag in soup(["script", "style"]):
        tag.decompose()

    text = soup.get_text(separator=" ")
    emails = set(EMAIL_REGEX.findall(text))

    # Also check mailto: links
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.startswith("mailto:"):
            email = href.replace("mailto:", "").split("?")[0].strip()
            if email:
                emails.add(email)

    return list(emails)


def extract_links(html, base_url):
    """Extract all href links from HTML, resolving relative URLs."""
    from urllib.parse import urljoin, urlparse

    soup = BeautifulSoup(html, "lxml")
    links = set()

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if href.startswith(("#", "javascript:", "mailto:")):
            continue
        full_url = urljoin(base_url, href)
        links.add(full_url)

    return list(links)


def extract_meta_content(html, property_name):
    """Extract content from meta tags (og:title, description, etc.)."""
    soup = BeautifulSoup(html, "lxml")

    tag = soup.find("meta", attrs={"property": property_name})
    if tag and tag.get("content"):
        return tag["content"]

    tag = soup.find("meta", attrs={"name": property_name})
    if tag and tag.get("content"):
        return tag["content"]

    return None

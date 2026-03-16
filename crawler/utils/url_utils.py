from urllib.parse import urlparse


def classify_url(url):
    """Classify a URL into a known platform or 'web'."""
    host = urlparse(url).netloc.lower()

    if "youtube.com" in host or "youtu.be" in host:
        return "youtube"
    if "instagram.com" in host:
        return "instagram"

    return "web"


def same_domain(url1, url2):
    """Check if two URLs share the same domain."""
    d1 = urlparse(url1).netloc.lower()
    d2 = urlparse(url2).netloc.lower()
    return d1 == d2


def normalize_url(url):
    """Basic URL normalization."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url.rstrip("/")

import time
import sys
import requests
from config import USER_AGENT, REQUEST_TIMEOUT


def fetch_with_retry(url, max_retries=3, delay_ms=2000, timeout=None):
    """Fetch a URL with retry logic for 429/5xx. Returns HTML string or None."""
    timeout = timeout or REQUEST_TIMEOUT
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
    }

    for attempt in range(max_retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)

            if resp.status_code == 200:
                return resp.text

            if resp.status_code == 429:
                wait = (delay_ms / 1000) * (2 ** attempt)
                print(
                    f'{{"type":"log","message":"429 on {url}, waiting {wait}s (attempt {attempt+1})"}}'
                , flush=True)
                time.sleep(wait)
                continue

            if resp.status_code >= 500:
                time.sleep(delay_ms / 1000)
                continue

            # 403, 404 etc - don't retry
            print(
                f'{{"type":"log","message":"HTTP {resp.status_code} on {url}"}}',
                flush=True,
            )
            return None

        except requests.RequestException as e:
            print(
                f'{{"type":"log","message":"Request error on {url}: {e}"}}',
                flush=True,
            )
            if attempt < max_retries:
                time.sleep(delay_ms / 1000)
            continue

    return None

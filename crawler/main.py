#!/usr/bin/env python3
"""
Lead Researcher Crawler Entry Point.
Reads JSON config from stdin, outputs JSONL to stdout.

JSONL protocol:
  {"type": "log",   "message": "..."}
  {"type": "error", "message": "..."}
  {"type": "lead",  "email": "...", "channel_name": "...", ...}
"""
import sys
import json
import os

# Add crawler directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scrapers.youtube import YouTubeScraper
from scrapers.instagram import InstagramScraper
from scrapers.generic import GenericScraper
from utils.url_utils import classify_url, normalize_url


def log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)


def error(message):
    print(json.dumps({"type": "error", "message": message}), flush=True)


def emit_lead(lead_data):
    lead_data["type"] = "lead"
    print(json.dumps(lead_data), flush=True)


SCRAPERS = {
    "youtube": YouTubeScraper,
    "instagram": InstagramScraper,
    "web": GenericScraper,
}


def main():
    config_line = sys.stdin.readline().strip()
    if not config_line:
        error("No config received on stdin")
        sys.exit(1)

    try:
        config = json.loads(config_line)
    except json.JSONDecodeError as e:
        error(f"Invalid JSON config: {e}")
        sys.exit(1)

    targets = config.get("targets", [])
    crawler_config = {
        "max_retries": config.get("max_retries", 3),
        "delay_ms": config.get("delay_ms", 2000),
        "max_depth": config.get("max_depth", 3),
    }

    log(f"Starting crawl for {len(targets)} targets")

    for target_url in targets:
        target_url = normalize_url(target_url)
        platform = classify_url(target_url)

        try:
            scraper_class = SCRAPERS.get(platform, GenericScraper)
            scraper = scraper_class(crawler_config)
            log(f"Crawling {target_url} with {platform} scraper")

            for lead in scraper.scrape(target_url):
                lead["platform"] = platform
                emit_lead(lead)

        except Exception as e:
            error(f"Error crawling {target_url}: {str(e)}")

    log("Crawl completed")


if __name__ == "__main__":
    main()

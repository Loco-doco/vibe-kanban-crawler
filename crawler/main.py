#!/usr/bin/env python3
"""
Lead Researcher Crawler Entry Point.
Reads JSON config from stdin, outputs JSONL to stdout.

JSONL protocol:
  {"type": "log",   "message": "..."}
  {"type": "error", "message": "..."}
  {"type": "lead",  "email": "...", "channel_name": "...", ...}

Supports two modes:
  - "url" (default): Scrape specific URLs provided in targets[]
  - "discovery": Search for creators by keywords[], then scrape discovered channels
"""
import sys
import json
import os

# Add crawler directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scrapers.youtube import YouTubeScraper
from scrapers.instagram import InstagramScraper
from scrapers.generic import GenericScraper
from scrapers.youtube_discovery import YouTubeDiscoveryScraper
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


def run_url_mode(config, crawler_config):
    """Original URL-based scraping mode."""
    targets = config.get("targets", [])
    target_count = config.get("target_count")

    log(f"Starting URL crawl for {len(targets)} targets" +
        (f" (target: {target_count} leads)" if target_count else ""))

    total_emitted = 0
    reached_target = False

    for target_url in targets:
        if reached_target:
            break

        target_url = normalize_url(target_url)
        platform = classify_url(target_url)

        try:
            scraper_class = SCRAPERS.get(platform, GenericScraper)
            scraper = scraper_class(crawler_config)
            log(f"Crawling {target_url} with {platform} scraper")

            for lead in scraper.scrape(target_url):
                lead["platform"] = platform
                emit_lead(lead)
                total_emitted += 1

                if target_count and total_emitted >= target_count:
                    log(f"Reached target count ({target_count}), stopping early")
                    reached_target = True
                    break

        except Exception as e:
            error(f"Error crawling {target_url}: {str(e)}")

    return total_emitted


def run_discovery_mode(config, crawler_config):
    """Keyword-based creator discovery mode."""
    keywords = config.get("keywords", [])
    category_tags = config.get("category_tags", [])
    platform = config.get("platform", "youtube")
    target_count = config.get("target_count")
    subscriber_min = config.get("subscriber_min")
    subscriber_max = config.get("subscriber_max")

    # Combine keywords with category tags for broader search
    # e.g. keywords=["리뷰"], categories=["뷰티"] → "뷰티 리뷰"
    if category_tags:
        combined = []
        for kw in keywords:
            combined.append(kw)
            for cat in category_tags:
                if cat.lower() not in kw.lower():
                    combined.append(f"{cat} {kw}")
        keywords = combined
        log(f"Combined keywords with categories: {keywords}")

    log(f"Starting discovery for keywords: {keywords} on {platform}" +
        (f" (target: {target_count} leads)" if target_count else ""))

    if platform != "youtube":
        error(f"Discovery mode currently only supports YouTube. Got: {platform}")
        return 0

    scraper = YouTubeDiscoveryScraper(crawler_config)
    total_emitted = 0
    reached_target = False

    for keyword in keywords:
        if reached_target:
            break

        try:
            for lead in scraper.scrape(keyword, subscriber_min, subscriber_max):
                lead["platform"] = "youtube"
                emit_lead(lead)
                total_emitted += 1

                if target_count and total_emitted >= target_count:
                    log(f"Reached target count ({target_count}), stopping early")
                    reached_target = True
                    break

        except Exception as e:
            error(f"Error discovering with keyword '{keyword}': {str(e)}")

    return total_emitted


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

    crawler_config = {
        "max_retries": config.get("max_retries", 3),
        "delay_ms": config.get("delay_ms", 2000),
        "max_depth": config.get("max_depth", 3),
    }

    mode = config.get("mode", "url")

    if mode == "discovery":
        total_emitted = run_discovery_mode(config, crawler_config)
    else:
        total_emitted = run_url_mode(config, crawler_config)

    log(f"Crawl completed. {total_emitted} leads emitted")


if __name__ == "__main__":
    main()

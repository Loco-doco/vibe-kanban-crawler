#!/usr/bin/env python3
"""
Lead Researcher Crawler Entry Point.
Reads JSON config from stdin, outputs JSONL to stdout.

JSONL protocol:
  {"type": "log",     "message": "..."}
  {"type": "error",   "message": "..."}
  {"type": "lead",    "email": "...", "channel_name": "...", ...}
  {"type": "summary", "termination_reason": "...", ...}

Supports two modes:
  - "url" (default): Scrape specific URLs provided in targets[]
  - "discovery": Search for creators by keywords[], then scrape discovered channels
"""
import sys
import json
import os
import time

# Add crawler directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scrapers.youtube import YouTubeScraper
from scrapers.instagram import InstagramScraper
from scrapers.generic import GenericScraper
from scrapers.youtube_discovery import YouTubeDiscoveryScraper
from utils.url_utils import classify_url, normalize_url
from utils.youtube_parser import extract_subscriber_count, classify_subscriber_failure
from utils.http_client import fetch_with_retry


def log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)


def error(message):
    print(json.dumps({"type": "error", "message": message}), flush=True)


def emit_lead(lead_data):
    lead_data["type"] = "lead"
    print(json.dumps(lead_data), flush=True)


def emit_summary(summary_data):
    summary_data["type"] = "summary"
    print(json.dumps(summary_data), flush=True)


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
    """
    Keyword-based creator discovery mode.

    target_count semantics:
      - Counts QUALIFIED leads only (unique + has email contact)
      - Leads without email still emitted (for manual review) but don't count
      - Continues searching until target reached or all sources exhausted
    """
    keywords = config.get("keywords", [])
    category_tags = config.get("category_tags", [])
    platform = config.get("platform", "youtube")
    target_count = config.get("target_count")
    subscriber_min = config.get("subscriber_min")
    subscriber_max = config.get("subscriber_max")

    # Combine keywords with category tags for broader search
    # e.g. keywords=["리뷰"], categories=["뷰티"] → "뷰티 리뷰"
    base_keywords = list(keywords)
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
        (f" (target: {target_count} qualified leads)" if target_count else ""))

    if platform != "youtube":
        error(f"Discovery mode currently only supports YouTube. Got: {platform}")
        emit_summary({
            "termination_reason": "system_error",
            "qualified_count": 0,
            "total_emitted": 0,
            "target_count": target_count,
        })
        return 0

    scraper = YouTubeDiscoveryScraper(crawler_config)

    # Tracking state
    qualified_count = 0       # leads with email (the real target)
    total_emitted = 0         # all leads emitted (including no-email)
    seen_channel_urls = set() # cross-keyword channel dedup
    seen_emails = set()       # cross-keyword email dedup

    # Stats for termination_reason judgment
    stats = {
        "keywords_tried": 0,
        "keywords_total": 0,  # set after all_keywords built
        "channels_discovered": 0,
        "channels_no_email": 0,
        "duplicates_skipped": 0,
    }

    def process_keyword(keyword):
        """Process a single keyword. Returns True if target reached."""
        nonlocal qualified_count, total_emitted

        stats["keywords_tried"] += 1
        remaining = (target_count - qualified_count) if target_count else None
        log(f"[{stats['keywords_tried']}/{stats['keywords_total']}] "
            f"Keyword '{keyword}' (qualified: {qualified_count}/{target_count or '∞'})")

        try:
            for lead in scraper.scrape(keyword, subscriber_min, subscriber_max,
                                       remaining_target=remaining):
                channel_url = lead.get("channel_url", "")
                email = lead.get("email")

                # Cross-keyword channel dedup
                if channel_url and channel_url in seen_channel_urls:
                    stats["duplicates_skipped"] += 1
                    continue
                if channel_url:
                    seen_channel_urls.add(channel_url)
                    stats["channels_discovered"] += 1

                # Cross-keyword email dedup
                if email and email.lower() in seen_emails:
                    stats["duplicates_skipped"] += 1
                    continue
                if email:
                    seen_emails.add(email.lower())

                # Attach source metadata
                lead["platform"] = "youtube"
                lead["discovery_keyword"] = keyword
                lead.setdefault("source_platform", "youtube")
                lead.setdefault("source_type", "profile_page")
                lead.setdefault("source_url", channel_url)

                emit_lead(lead)
                total_emitted += 1

                # Count qualified leads (has email = reviewable contact)
                if email:
                    qualified_count += 1
                else:
                    stats["channels_no_email"] += 1

                # Check target (qualified leads only)
                if target_count and qualified_count >= target_count:
                    log(f"Target reached: {qualified_count} qualified leads")
                    return True

        except Exception as e:
            error(f"Error discovering with keyword '{keyword}': {str(e)}")

        return False

    # ── Phase 1: Try all original + combined keywords ──
    all_keywords = list(keywords)
    target_reached = False

    # ── Phase 2: If target not reached, try keyword variations ──
    # Pre-build variation keywords so we know total count
    variation_prefixes = ["인기", "추천", "best", "top", "유명", "독학"]
    variation_suffixes = ["유튜버", "크리에이터", "채널", "강의", "강사", "선생님"]
    variation_keywords = []

    for prefix in variation_prefixes:
        for kw in base_keywords[:3]:
            variant = f"{prefix} {kw}"
            if variant not in all_keywords:
                variation_keywords.append(variant)

    for suffix in variation_suffixes:
        for kw in base_keywords[:3]:
            if suffix not in kw:
                variant = f"{kw} {suffix}"
                if variant not in all_keywords:
                    variation_keywords.append(variant)

    # Set total keyword count for logging
    stats["keywords_total"] = len(all_keywords) + len(variation_keywords)

    # Process base keywords
    for keyword in all_keywords:
        if process_keyword(keyword):
            target_reached = True
            break

    # Process variation keywords if target not reached
    if not target_reached and target_count and qualified_count < target_count:
        if variation_keywords:
            log(f"Target not reached ({qualified_count}/{target_count}). "
                f"Trying {len(variation_keywords)} keyword variations...")

            for keyword in variation_keywords:
                if process_keyword(keyword):
                    target_reached = True
                    break

    # ── Determine termination reason ──
    if target_reached or (target_count and qualified_count >= target_count):
        termination_reason = "target_reached"
    elif (stats["channels_discovered"] > 0
          and stats["channels_no_email"] > stats["channels_discovered"] * 0.8):
        termination_reason = "insufficient_contact_coverage"
    elif (stats["duplicates_skipped"] > 0
          and stats["duplicates_skipped"] > stats["channels_discovered"] * 0.7):
        termination_reason = "duplicate_heavy"
    else:
        termination_reason = "sources_exhausted"

    # ── Emit summary ──
    emit_summary({
        "termination_reason": termination_reason,
        "qualified_count": qualified_count,
        "total_emitted": total_emitted,
        "target_count": target_count,
        **stats,
    })

    log(f"Discovery complete: {qualified_count} qualified leads "
        f"(target: {target_count}), reason: {termination_reason}")

    return total_emitted


def run_enrich_subscribers(config, crawler_config):
    """
    Backfill subscriber_count for existing leads.
    Input: config.leads = [{"lead_id": 1, "channel_url": "https://..."}, ...]
    Output: {"type": "subscriber_update", "lead_id": 1, "subscriber_count": 12000}
    """
    leads = config.get("leads", [])
    log(f"Starting subscriber backfill for {len(leads)} leads")

    updated = 0
    failed = 0

    for item in leads:
        lead_id = item["lead_id"]
        channel_url = item["channel_url"]

        try:
            html = fetch_with_retry(
                channel_url.rstrip("/"),
                crawler_config["max_retries"],
                crawler_config["delay_ms"],
            )
            if html:
                count = extract_subscriber_count(html)
                if count is not None:
                    print(
                        json.dumps({
                            "type": "subscriber_update",
                            "lead_id": lead_id,
                            "subscriber_count": count,
                        }),
                        flush=True,
                    )
                    updated += 1
                else:
                    failure_reason = classify_subscriber_failure(html)
                    log(f"No subscriber count found for lead {lead_id}: {failure_reason}")
                    print(
                        json.dumps({
                            "type": "subscriber_failure",
                            "lead_id": lead_id,
                            "failure_reason": failure_reason,
                        }),
                        flush=True,
                    )
                    failed += 1
            else:
                log(f"Failed to fetch channel page for lead {lead_id}")
                print(
                    json.dumps({
                        "type": "subscriber_failure",
                        "lead_id": lead_id,
                        "failure_reason": "fetch_failed",
                    }),
                    flush=True,
                )
                failed += 1
        except Exception as e:
            error(f"Error processing lead {lead_id}: {str(e)}")
            print(
                json.dumps({
                    "type": "subscriber_failure",
                    "lead_id": lead_id,
                    "failure_reason": "fetch_failed",
                }),
                flush=True,
            )
            failed += 1

        # Rate limiting between requests
        time.sleep(crawler_config["delay_ms"] / 1000)

    emit_summary({
        "termination_reason": "completed",
        "total_processed": len(leads),
        "updated": updated,
        "failed": failed,
    })

    return updated


def run_enrich_channels(config, crawler_config):
    """
    Enrich existing leads with channel page data.
    Input: config.leads = [{"lead_id": 1, "channel_url": "https://..."}, ...]
    Output: {"type": "enrichment", "lead_id": 1, "profile_summary": "...", ...}
    """
    from scrapers.channel_enricher import ChannelEnricher

    leads = config.get("leads", [])
    log(f"Starting channel enrichment for {len(leads)} leads")

    enricher = ChannelEnricher(crawler_config)
    enriched = 0
    failed = 0

    for item in leads:
        lead_id = item["lead_id"]
        channel_url = item["channel_url"]

        try:
            result = enricher.enrich(lead_id, channel_url)
            if result:
                print(json.dumps(result, ensure_ascii=False), flush=True)
                enriched += 1
            else:
                log(f"No enrichment data for lead {lead_id}")
                failed += 1
        except Exception as e:
            error(f"Error enriching lead {lead_id}: {str(e)}")
            failed += 1

        time.sleep(crawler_config["delay_ms"] / 1000)

    emit_summary({
        "termination_reason": "completed",
        "total_processed": len(leads),
        "enriched": enriched,
        "failed": failed,
    })

    return enriched


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
    elif mode == "enrich_subscribers":
        total_emitted = run_enrich_subscribers(config, crawler_config)
    elif mode == "enrich_channels":
        total_emitted = run_enrich_channels(config, crawler_config)
    else:
        total_emitted = run_url_mode(config, crawler_config)

    log(f"Crawl completed. {total_emitted} leads emitted")


if __name__ == "__main__":
    main()

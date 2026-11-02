#!/usr/bin/env python3
"""Crawl an explicit list of URLs with Crawl4AI and emit JSON on stdout.

This worker is intentionally single-purpose:
- It only visits URLs passed on the command line (no link following).
- It checks each host's robots.txt before crawling.
- It writes diagnostics to stderr so stdout stays valid JSON.

Usage:
    python crawl4ai_crawl.py --urls https://example.com/page https://example.com/other
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import sys
import urllib.request
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CacheMode,
    CrawlerRunConfig,
    DefaultMarkdownGenerator,
)
from crawl4ai.content_filter_strategy import PruningContentFilterLXML

logger = logging.getLogger("rag-crawler")

USER_AGENT = "EngineerPlaybookRagBot/1.0 (+https://engineerplaybook.io)"
ROBOTS_TIMEOUT_SECONDS = 10


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl explicit URLs with Crawl4AI.")
    parser.add_argument(
        "--urls",
        nargs="+",
        required=True,
        help="One or more http(s) URLs to crawl. No links are followed.",
    )
    return parser.parse_args()


def validate_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"Only absolute http(s) URLs are supported: {value}")
    return value


def robots_allows(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)

    request = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(request, timeout=ROBOTS_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8", errors="replace")
            parser.parse(body.splitlines())
    except HTTPError as exc:
        if exc.code in {401, 403}:
            logger.warning("robots.txt for %s returned %s; treating as disallowed.", robots_url, exc.code)
            return False
        # A missing robots.txt (404) means crawling is allowed.
        return True
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("Could not read %s (%s); proceeding.", robots_url, exc)
        return True

    return parser.can_fetch(USER_AGENT, url)


def extract_markdown(result: Any) -> str:
    markdown = getattr(result, "markdown", None)
    if markdown is None:
        return ""
    if isinstance(markdown, str):
        return markdown

    for attribute in ("fit_markdown", "raw_markdown"):
        value = getattr(markdown, attribute, None)
        if isinstance(value, str) and value.strip():
            return value

    return str(markdown)


def extract_title(result: Any, fallback: str) -> str:
    metadata = getattr(result, "metadata", None)
    if not isinstance(metadata, dict):
        return fallback

    for key in ("title", "og:title", "twitter:title"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return fallback


def clean_metadata(result: Any) -> dict[str, Any]:
    metadata = getattr(result, "metadata", None)
    if not isinstance(metadata, dict):
        return {}

    cleaned: dict[str, Any] = {}
    for key, value in metadata.items():
        if value is None or isinstance(value, (str, int, float, bool)):
            cleaned[str(key)] = value
        elif isinstance(value, (list, dict)):
            try:
                json.dumps(value)
                cleaned[str(key)] = value
            except TypeError:
                continue

    return cleaned


async def crawl(urls: list[str]) -> list[dict[str, Any]]:
    browser_config = BrowserConfig(verbose=False, user_agent=USER_AGENT)
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        check_robots_txt=True,
        user_agent=USER_AGENT,
        excluded_tags=["nav", "footer", "aside", "header", "form"],
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilterLXML(threshold=0.48, threshold_type="fixed"),
        ),
    )
    pages: list[dict[str, Any]] = []

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for url in urls:
            if not robots_allows(url):
                logger.warning("Skipping %s: disallowed by robots.txt.", url)
                pages.append(
                    {
                        "url": url,
                        "title": url,
                        "markdown": "",
                        "metadata": {},
                        "error": "Blocked by robots.txt",
                    }
                )
                continue

            try:
                result = await crawler.arun(url=url, config=run_config)
                if not getattr(result, "success", False):
                    raise RuntimeError(getattr(result, "error_message", None) or "crawl failed")

                pages.append(
                    {
                        "url": url,
                        "final_url": getattr(result, "url", url),
                        "title": extract_title(result, url),
                        "markdown": extract_markdown(result),
                        "metadata": clean_metadata(result),
                    }
                )
            except Exception as exc:  # noqa: BLE001 - keep one bad URL from aborting the batch
                logger.error("Failed to crawl %s: %s", url, exc)
                pages.append(
                    {
                        "url": url,
                        "title": url,
                        "markdown": "",
                        "metadata": {},
                        "error": str(exc),
                    }
                )

    return pages


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,
        format="%(levelname)s %(message)s",
    )

    args = parse_args()

    try:
        urls = list(dict.fromkeys(validate_url(url) for url in args.urls))
    except ValueError as exc:
        logger.error("%s", exc)
        return 2

    with contextlib.redirect_stdout(sys.stderr):
        pages = asyncio.run(crawl(urls))

    json.dump(pages, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")

    return 0 if any(page.get("markdown") for page in pages) else 1


if __name__ == "__main__":
    raise SystemExit(main())

from abc import ABC, abstractmethod


class BaseScraper(ABC):
    def __init__(self, config):
        self.max_retries = config.get("max_retries", 3)
        self.delay_ms = config.get("delay_ms", 2000)
        self.max_depth = config.get("max_depth", 3)

    @abstractmethod
    def scrape(self, url):
        """
        Generator that yields lead dicts:
        {
            "email": str,
            "channel_name": str | None,
            "channel_url": str,
            "evidence_link": str,
            "confidence_score": float,
            "subscriber_count": int | None,
        }
        """
        pass

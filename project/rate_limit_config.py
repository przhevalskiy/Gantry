"""Rate limiting configuration and monitoring for Claude API calls."""

from dataclasses import dataclass
import time
import structlog

logger = structlog.get_logger(__name__)

@dataclass
class RateLimitConfig:
    """Configuration for rate limit handling."""
    max_retries: int = 3
    initial_retry_delay: float = 60.0  # seconds
    max_retry_delay: float = 300.0     # 5 minutes
    rate_limit_threshold_warning: float = 0.8  # Warn at 80% of limit
    
    # Claude API rate limits (tokens per minute)
    claude_sonnet_input_limit: int = 450_000
    claude_sonnet_output_limit: int = 180_000

@dataclass
class RateLimitTracker:
    """Track rate limit usage across the swarm."""
    current_minute_tokens: int = 0
    current_minute_start: float = 0.0
    rate_limit_hits: int = 0
    total_retries: int = 0
    
    def reset_minute_counter(self) -> None:
        """Reset the per-minute token counter."""
        self.current_minute_tokens = 0
        self.current_minute_start = time.time()
    
    def add_tokens(self, input_tokens: int, output_tokens: int) -> None:
        """Add tokens to current minute counter."""
        current_time = time.time()
        
        # Reset if we're in a new minute
        if current_time - self.current_minute_start > 60:
            self.reset_minute_counter()
        
        self.current_minute_tokens += input_tokens + output_tokens
    
    def is_near_limit(self, config: RateLimitConfig) -> bool:
        """Check if we're approaching the rate limit."""
        return (self.current_minute_tokens / config.claude_sonnet_input_limit) > config.rate_limit_threshold_warning
    
    def get_usage_percentage(self, config: RateLimitConfig) -> float:
        """Get current usage as percentage of limit."""
        return (self.current_minute_tokens / config.claude_sonnet_input_limit) * 100

# Global rate limit tracker
_rate_tracker = RateLimitTracker()
_rate_config = RateLimitConfig()

def get_rate_tracker() -> RateLimitTracker:
    """Get the global rate limit tracker."""
    return _rate_tracker

def get_rate_config() -> RateLimitConfig:
    """Get the global rate limit configuration."""
    return _rate_config

def log_rate_limit_warning() -> None:
    """Log a rate limit warning."""
    tracker = get_rate_tracker()
    config = get_rate_config()
    
    logger.warning(
        "approaching_rate_limit",
        current_tokens=tracker.current_minute_tokens,
        limit=config.claude_sonnet_input_limit,
        usage_percentage=tracker.get_usage_percentage(config),
        rate_limit_hits=tracker.rate_limit_hits
    )

def log_rate_limit_hit(retry_count: int, delay: float, error_message: str) -> None:
    """Log when we hit a rate limit."""
    tracker = get_rate_tracker()
    tracker.rate_limit_hits += 1
    tracker.total_retries += 1
    
    logger.warning(
        "rate_limit_hit",
        retry_count=retry_count,
        delay_seconds=delay,
        total_rate_limit_hits=tracker.rate_limit_hits,
        total_retries=tracker.total_retries,
        error=error_message
    )

def log_rate_limit_recovery() -> None:
    """Log when we successfully recover from rate limit."""
    tracker = get_rate_tracker()
    
    logger.info(
        "rate_limit_recovery",
        total_rate_limit_hits=tracker.rate_limit_hits,
        total_retries=tracker.total_retries,
        current_tokens=tracker.current_minute_tokens
    )

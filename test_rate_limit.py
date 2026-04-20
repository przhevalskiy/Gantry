#!/usr/bin/env python3
"""Test rate limit handling in planner.py"""

import asyncio
import sys
from unittest.mock import AsyncMock, patch
import anthropic

# Add project to path
sys.path.append('/Users/alexprzhevalskiy/Desktop/Keystone')

from project.planner import next_step, PlannerError
from project.rate_limit_config import get_rate_tracker, get_rate_config

async def test_rate_limit_handling():
    """Test that rate limits are handled gracefully with exponential backoff."""
    
    print("Testing rate limit handling...")
    
    # Mock Claude client to simulate rate limit error
    mock_client = AsyncMock()
    rate_limit_error = anthropic.RateLimitError(
        message="Rate limit exceeded",
        response=Mock(),
        body={"error": {"type": "rate_limit_error"}}
    )
    
    # Configure mock to raise rate limit error twice, then succeed
    mock_client.messages.create.side_effect = [
        rate_limit_error,
        rate_limit_error,
        AsyncMock(
            content=[Mock(type="text", text="Test response")],
            stop_reason="end_turn",
            usage=Mock(input_tokens=1000, output_tokens=500)
        )
    ]
    
    # Test the rate limit handling
    with patch('anthropic.AsyncAnthropic', return_value=mock_client):
        try:
            result, context = await next_step(
                task_prompt="Test task",
                context=[],
                tools=[],
                system_prompt="Test system"
            )
            
            print("✅ Rate limit handling test PASSED")
            print(f"   - Result type: {type(result)}")
            print(f"   - Retry attempts: {mock_client.messages.create.call_count}")
            
            # Verify exponential backoff timing
            if mock_client.messages.create.call_count == 3:
                print("   - Exponential backoff: ✓")
            else:
                print("   - Exponential backoff: ✗")
                
            # Check rate tracker
            tracker = get_rate_tracker()
            config = get_rate_config()
            print(f"   - Rate limit hits: {tracker.rate_limit_hits}")
            print(f"   - Total retries: {tracker.total_retries}")
            print(f"   - Current tokens: {tracker.current_minute_tokens}")
            
            return True
            
        except Exception as e:
            print(f"❌ Rate limit handling test FAILED: {e}")
            return False

async def test_max_retry_limit():
    """Test that max retry limit is respected."""
    
    print("\nTesting max retry limit...")
    
    # Mock Claude client to always raise rate limit error
    mock_client = AsyncMock()
    rate_limit_error = anthropic.RateLimitError(
        message="Rate limit exceeded",
        response=Mock(),
        body={"error": {"type": "rate_limit_error"}}
    )
    mock_client.messages.create.side_effect = rate_limit_error
    
    # Test max retry limit
    with patch('anthropic.AsyncAnthropic', return_value=mock_client):
        try:
            result, context = await next_step(
                task_prompt="Test task",
                context=[],
                tools=[],
                system_prompt="Test system"
            )
            
            print("❌ Max retry limit test FAILED - should have raised PlannerError")
            return False
            
        except PlannerError as e:
            config = get_rate_config()
            expected_calls = config.max_retries + 1  # Initial attempt + retries
            
            if mock_client.messages.create.call_count == expected_calls:
                print("✅ Max retry limit test PASSED")
                print(f"   - Total attempts: {mock_client.messages.create.call_count}")
                print(f"   - Error message: {e.message}")
                return True
            else:
                print(f"❌ Max retry limit test FAILED - expected {expected_calls} calls, got {mock_client.messages.create.call_count}")
                return False

class Mock:
    """Simple mock object for testing."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

async def main():
    """Run all rate limit tests."""
    print("Running rate limit handling tests...\n")
    
    tests = [
        test_rate_limit_handling,
        test_max_retry_limit
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
            results.append(False)
    
    print(f"\n{'='*50}")
    print(f"Test Results: {sum(results)}/{len(results)} passed")
    
    if all(results):
        print("🎉 All rate limit tests PASSED!")
        return 0
    else:
        print("❌ Some tests FAILED!")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

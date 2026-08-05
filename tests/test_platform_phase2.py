"""Phase 2 platform tests — quotas, rate limiting, scopes."""
import pytest

from api.middleware import rate_limit as rate_limiter
from api.repositories.quotas import OrgQuotas, QuotaExceeded


@pytest.mark.asyncio
async def test_rate_limit_allows_under_cap():
    rate_limiter.reset()
    org = "org-rate-test"
    allowed, limit = await rate_limiter.check_rate_limit(org)
    assert allowed is True
    assert limit >= 10


@pytest.mark.asyncio
async def test_rate_limit_blocks_over_cap():
    rate_limiter.reset()
    org = "org-rate-block"
    from api.middleware import rate_limit as rl_module

    async def _tiny(_org):
        return OrgQuotas(org_id=_org, requests_per_minute=2)

    original = rl_module.get_quotas
    rl_module.get_quotas = _tiny
    try:
        assert (await rate_limiter.check_rate_limit(org))[0] is True
        assert (await rate_limiter.check_rate_limit(org))[0] is True
        assert (await rate_limiter.check_rate_limit(org))[0] is False
    finally:
        rl_module.get_quotas = original
        rate_limiter.reset()


def test_quota_exceeded_message():
    exc = QuotaExceeded("too many", limit="max_concurrent_tasks")
    assert exc.limit == "max_concurrent_tasks"


def test_valid_scopes_include_least_privilege():
    from api.deps import VALID_SCOPES

    assert "tasks:write" in VALID_SCOPES
    assert "projects:read" in VALID_SCOPES
    assert "admin" in VALID_SCOPES

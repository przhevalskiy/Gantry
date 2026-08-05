"""Per-org quota limits and enforcement."""
from __future__ import annotations

from dataclasses import dataclass

from api import db

TERMINAL_STATUSES = ("completed", "failed", "cancelled", "terminated", "timeout")

DEFAULT_MAX_CONCURRENT = 10
DEFAULT_MAX_TASKS_PER_DAY = 500
DEFAULT_MAX_BULK_SIZE = 50
DEFAULT_REQUESTS_PER_MINUTE = 120


@dataclass
class OrgQuotas:
    org_id: str
    max_concurrent_tasks: int = DEFAULT_MAX_CONCURRENT
    max_tasks_per_day: int = DEFAULT_MAX_TASKS_PER_DAY
    max_bulk_size: int = DEFAULT_MAX_BULK_SIZE
    requests_per_minute: int = DEFAULT_REQUESTS_PER_MINUTE


async def get_quotas(org_id: str) -> OrgQuotas:
    if not db.is_available():
        return OrgQuotas(org_id=org_id)
    row = await db.fetch_one("SELECT * FROM org_quotas WHERE org_id = %s", (org_id,))
    if not row:
        return OrgQuotas(org_id=org_id)
    return OrgQuotas(
        org_id=org_id,
        max_concurrent_tasks=row["max_concurrent_tasks"],
        max_tasks_per_day=row["max_tasks_per_day"],
        max_bulk_size=row["max_bulk_size"],
        requests_per_minute=row["requests_per_minute"],
    )


async def update_quotas(org_id: str, **kwargs) -> OrgQuotas:
    if not db.is_available():
        return OrgQuotas(org_id=org_id, **{k: v for k, v in kwargs.items() if v is not None})

    current = await get_quotas(org_id)
    values = {
        "max_concurrent_tasks": kwargs.get("max_concurrent_tasks", current.max_concurrent_tasks),
        "max_tasks_per_day": kwargs.get("max_tasks_per_day", current.max_tasks_per_day),
        "max_bulk_size": kwargs.get("max_bulk_size", current.max_bulk_size),
        "requests_per_minute": kwargs.get("requests_per_minute", current.requests_per_minute),
    }
    await db.execute(
        """
        INSERT INTO org_quotas (org_id, max_concurrent_tasks, max_tasks_per_day, max_bulk_size, requests_per_minute)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (org_id) DO UPDATE SET
            max_concurrent_tasks = EXCLUDED.max_concurrent_tasks,
            max_tasks_per_day = EXCLUDED.max_tasks_per_day,
            max_bulk_size = EXCLUDED.max_bulk_size,
            requests_per_minute = EXCLUDED.requests_per_minute,
            updated_at = now()
        """,
        (org_id, *values.values()),
    )
    return OrgQuotas(org_id=org_id, **values)


async def count_concurrent_tasks(org_id: str) -> int:
    if not db.is_available():
        return 0
    row = await db.fetch_one(
        """
        SELECT COUNT(*) AS count FROM api_tasks
        WHERE org_id = %s
          AND webhook_fired = false
          AND (status IS NULL OR status NOT IN %s)
        """,
        (org_id, TERMINAL_STATUSES),
    )
    return int(row["count"]) if row else 0


async def count_tasks_today(org_id: str) -> int:
    if not db.is_available():
        return 0
    row = await db.fetch_one(
        """
        SELECT COUNT(*) AS count FROM usage_events
        WHERE org_id = %s
          AND event_type = 'task.submitted'
          AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
        """,
        (org_id,),
    )
    return int(row["count"]) if row else 0


class QuotaExceeded(Exception):
    def __init__(self, message: str, *, limit: str):
        super().__init__(message)
        self.limit = limit


async def check_task_submit(org_id: str, *, bulk_count: int = 1) -> OrgQuotas:
    quotas = await get_quotas(org_id)

    if bulk_count > quotas.max_bulk_size:
        raise QuotaExceeded(
            f"bulk size {bulk_count} exceeds limit of {quotas.max_bulk_size}",
            limit="max_bulk_size",
        )

    concurrent = await count_concurrent_tasks(org_id)
    if concurrent + bulk_count > quotas.max_concurrent_tasks:
        raise QuotaExceeded(
            f"{concurrent} concurrent tasks — limit is {quotas.max_concurrent_tasks}",
            limit="max_concurrent_tasks",
        )

    daily = await count_tasks_today(org_id)
    if daily + bulk_count > quotas.max_tasks_per_day:
        raise QuotaExceeded(
            f"{daily} tasks submitted today — limit is {quotas.max_tasks_per_day}",
            limit="max_tasks_per_day",
        )

    return quotas

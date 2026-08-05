#!/usr/bin/env python3
"""
Database setup + registry.json / api_keys.json migration.

Usage:
    DATABASE_URL=postgresql://... python scripts/migrate_db.py

Steps:
    1. Run 001_initial.sql (idempotent)
    2. Run 002_platform.sql (idempotent)
    3. Import projects from registry.json
    4. Import API keys from api_keys.json
"""
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT / ".env.local", override=False)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL is not set.")
    print("  export DATABASE_URL=postgresql://user:pass@host:5432/dbname")
    sys.exit(1)

import psycopg


async def main():
    print(f"Connecting to: {DATABASE_URL[:40]}...")
    async with await psycopg.AsyncConnection.connect(DATABASE_URL, autocommit=True) as conn:

        for migration in (
            "001_initial.sql",
            "002_platform.sql",
            "003_integrator.sql",
            "004_secrets.sql",
            "005_platform_grade.sql",
            "006_distribution.sql",
            "007_github_app.sql",
        ):
            sql = (ROOT / "api" / "migrations" / migration).read_text()
            await conn.execute(sql)
            print(f"✓ Schema applied: {migration}")

        registry_path = Path(os.getenv("GANTRY_FILES_BASE", Path.home() / ".gantry" / "projects")) / "registry.json"
        if registry_path.exists():
            projects = json.loads(registry_path.read_text())
            print(f"  Found {len(projects)} project(s) in registry.json")
            migrated, skipped = 0, 0
            for p in projects:
                existing = await conn.execute(
                    "SELECT id FROM projects WHERE id = %s", (p["id"],)
                )
                if await existing.fetchone():
                    skipped += 1
                    continue
                await conn.execute(
                    """
                    INSERT INTO projects (
                        id, org_id, user_id, name, slug, repo_path,
                        github_url, github_owner, github_repo, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        p["id"],
                        "00000000-0000-4000-8000-000000000001",
                        "system",
                        p["name"],
                        p["slug"],
                        p["repo_path"],
                        p.get("github_url"),
                        p.get("github_owner"),
                        p.get("github_repo"),
                        p.get("created_at"),
                    ),
                )
                migrated += 1
            print(f"✓ Migrated {migrated} project(s), skipped {skipped}")

        keys_path = Path(os.getenv("GANTRY_HOME", str(Path.home() / ".gantry"))) / "api_keys.json"
        if keys_path.exists():
            keys = json.loads(keys_path.read_text())
            km = 0
            for k in keys:
                if not k.get("active", True):
                    continue
                await conn.execute(
                    """
                    INSERT INTO api_keys (id, org_id, name, key_hash, scopes, active, created_at, last_used_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (key_hash) DO NOTHING
                    """,
                    (
                        k.get("id"),
                        k.get("org_id", "00000000-0000-4000-8000-000000000001"),
                        k["name"],
                        k["key_hash"],
                        k.get("scopes", ["admin"]),
                        k.get("active", True),
                        k.get("created_at"),
                        k.get("last_used_at"),
                    ),
                )
                km += 1
            print(f"✓ Migrated {km} API key(s) from api_keys.json")

        print()
        print("Next steps:")
        print("  1. Set DATABASE_URL on the Gantry API host")
        print("  2. curl -X POST http://localhost:8001/v1/keys -d '{\"name\":\"bootstrap\"}'")
        print("  3. Public /v1/* routes no longer depend on the UI")


if __name__ == "__main__":
    asyncio.run(main())

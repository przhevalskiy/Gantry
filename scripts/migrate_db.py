#!/usr/bin/env python3
"""
One-time database setup + registry.json migration.

Usage:
    DATABASE_URL=postgresql://... python scripts/migrate_db.py

Steps:
    1. Run 001_initial.sql (idempotent — all CREATE IF NOT EXISTS)
    2. Import any projects from registry.json that aren't already in the DB
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

        # 1. Run schema
        sql = (ROOT / "api" / "migrations" / "001_initial.sql").read_text()
        await conn.execute(sql)
        print("✓ Schema applied")

        # 2. Migrate registry.json
        registry_path = Path(os.getenv("GANTRY_FILES_BASE", Path.home() / ".gantry" / "projects")) / "registry.json"
        if not registry_path.exists():
            print("  No registry.json found — skipping migration")
            return

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
                INSERT INTO projects (id, user_id, name, slug, repo_path, github_url, github_owner, github_repo, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    p["id"], "system", p["name"], p["slug"], p["repo_path"],
                    p.get("github_url"), p.get("github_owner"), p.get("github_repo"),
                    p.get("created_at"),
                ),
            )
            migrated += 1

        print(f"✓ Migrated {migrated} project(s), skipped {skipped} (already in DB)")
        print()
        print("Next steps:")
        print("  1. Set GANTRY_API_URL on Vercel to point to this Hetzner API")
        print("  2. Set INTERNAL_API_KEY on both Vercel and Hetzner")
        print("  3. Deploy — registry.json is no longer needed")


if __name__ == "__main__":
    asyncio.run(main())

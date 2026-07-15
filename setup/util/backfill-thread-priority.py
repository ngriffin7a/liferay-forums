#!/usr/bin/env python3

# SPDX-License-Identifier: LGPL-2.1-or-later
"""
Backfill the priority field on Forum Threads created before the thread-priority
feature existed.

The message list sorts by `priority:desc`. Threads created before the feature
have no priority value at all (NULL), and NULL ordering in a descending sort is
database-specific — on PostgreSQL, NULLs sort first, which would pin every
legacy thread above genuinely prioritized ones. This script PATCHes
`priority: 0` onto every thread that has no priority yet, making the sort
deterministic everywhere. Threads that already have a priority are untouched.

Usage:
    python3 backfill-thread-priority.py <siteId> [BASE_URL] [--email EMAIL] [--password PASSWORD]

Defaults:
    BASE_URL: http://localhost:8080
    EMAIL:    test@liferay.com
    PASSWORD: test
"""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor

import requests

MAX_WORKERS = 10


def make_session(email, password):
    s = requests.Session()
    s.headers.update({
        "Authorization": "Basic " + base64.b64encode(f"{email}:{password}".encode()).decode(),
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    return s


def fetch_threads_without_priority(session, base, site_id):
    thread_ids = []
    page = 1
    seen = 0
    while True:
        resp = session.get(
            f"{base}/o/c/forumthreads/scopes/{site_id}",
            params={"page": page, "pageSize": 100, "fields": "id,priority"},
        )
        if not resp.ok:
            print(f"  ❌ Failed to list threads: {resp.status_code}")
            break
        body = resp.json()
        items = body.get("items", [])
        seen += len(items)
        thread_ids.extend(item["id"] for item in items if item.get("priority") is None)
        if seen >= body.get("totalCount", 0) or not items:
            break
        page += 1
    return thread_ids


def main():
    parser = argparse.ArgumentParser(
        description="Backfill priority=0 on Forum Threads that have no priority value.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("site_id", help="Site (group) ID to scope all entries to")
    parser.add_argument("base_url", nargs="?", default="http://localhost:8080",
                        help="Liferay portal base URL")
    parser.add_argument("--email", default="test@liferay.com", help="Admin email address")
    parser.add_argument("--password", default="test", help="Admin password")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")

    print(f"Target: {base}  Site ID: {args.site_id}")

    session = make_session(args.email, args.password)
    thread_ids = fetch_threads_without_priority(session, base, args.site_id)

    if not thread_ids:
        print("\n✅ Nothing to backfill — every thread already has a priority.")
        return

    print(f"\n═══ Backfilling {len(thread_ids)} threads ({MAX_WORKERS} parallel workers) ═══")

    def _patch(thread_id):
        resp = session.patch(f"{base}/o/c/forumthreads/{thread_id}", json={"priority": 0})
        return thread_id, resp.status_code

    patched = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for thread_id, status in executor.map(_patch, thread_ids):
            if status < 300:
                patched += 1
            else:
                print(f"  ❌ Failed to patch thread {thread_id}: {status}")

    print(f"\n✅ Backfilled {patched}/{len(thread_ids)} threads with priority 0.")


if __name__ == "__main__":
    main()

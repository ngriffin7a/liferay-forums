#!/usr/bin/env python3

# Copyright (c) 2000-present Liferay, Inc. All rights reserved.
#
# This library is free software; you can redistribute it and/or modify it under
# the terms of the GNU Lesser General Public License as published by the Free
# Software Foundation; either version 2.1 of the License, or (at your option)
# any later version.
#
# This library is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
# details.
"""
Delete all ForumStatsUser entries via the Liferay Objects REST API.

Run this before re-executing populate-forum-stats-users.groovy to ensure
a clean slate with no duplicate entries.

Usage:
    python3 delete-forum-stats-users.py [BASE_URL] [--scope SCOPE] [--email EMAIL] [--password PASSWORD]

Defaults:
    BASE_URL: http://localhost:8080
    SCOPE:    (unscoped — works for most admin accounts)
    EMAIL:    test@liferay.com
    PASSWORD: test

If the unscoped endpoint returns 0 entries, pass the site groupId or
friendly URL as --scope, e.g.: --scope 20127 or --scope guest
"""

import argparse
import base64
import json
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

PAGE_SIZE = 100
WORKERS = 20


def api(method, url, auth):
    req = urllib.request.Request(url, method=method, headers={
        "Authorization": auth,
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def detect_scope(base, auth):
    """Return the groupId of the first site that has ForumStatsUser entries."""
    status, body = api("GET", f"{base}/o/headless-admin-user/v1.0/sites?pageSize=50", auth)
    if status >= 400:
        return None
    for site in json.loads(body).get("items", []):
        site_id = str(site.get("id", ""))
        status, body = api("GET", list_url(base, site_id, 1), auth)
        if status < 300 and json.loads(body).get("totalCount", 0) > 0:
            return site_id
    return None


def list_url(base, scope, page):
    if scope:
        endpoint = f"{base}/o/c/forumstatsusers/scopes/{scope}/"
    else:
        endpoint = f"{base}/o/c/forumstatsusers/"
    return f"{endpoint}?pageSize={PAGE_SIZE}&page={page}"


def main():
    parser = argparse.ArgumentParser(
        description="Delete all ForumStatsUser entries via the Liferay Objects REST API.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("base_url", nargs="?", default="http://localhost:8080",
                        help="Liferay portal base URL")
    parser.add_argument("--scope", default="",
                        help="Site scope key (groupId or friendly URL) — omit for unscoped")
    parser.add_argument("--email", default="test@liferay.com",
                        help="Liferay admin email")
    parser.add_argument("--password", default="test",
                        help="Liferay admin password")
    args = parser.parse_args()

    auth = "Basic " + base64.b64encode(f"{args.email}:{args.password}".encode()).decode()
    base = args.base_url.rstrip("/")

    # --- Resolve scope if not provided ---
    # Site-scoped objects return 409 on the unscoped endpoint; auto-detect
    # the right scope by querying the Liferay sites API.
    scope = args.scope
    if not scope:
        status, body = api("GET", list_url(base, "", 1), auth)
        if status == 409:
            print("Object is site-scoped — detecting scope from Liferay sites API...", flush=True)
            scope = detect_scope(base, auth)
            if not scope:
                print("❌ Could not detect scope automatically. Pass --scope <groupId> and retry.")
                sys.exit(1)
            print(f"Using scope: {scope}", flush=True)
        elif status >= 400:
            print(f"❌ Failed to list entries: HTTP {status}\n{body[:300]}")
            sys.exit(1)

    # --- Fetch first page to get total count ---
    print("Fetching ForumStatsUser entries...", flush=True)
    status, body = api("GET", list_url(base, scope, 1), auth)
    if status >= 400:
        print(f"❌ Failed to list entries: HTTP {status}\n{body[:300]}")
        sys.exit(1)

    data = json.loads(body)
    total = data.get("totalCount", 0)

    if total == 0:
        print("No ForumStatsUser entries found.")
        sys.exit(0)

    print(f"Found {total} entries. Collecting IDs...", flush=True)

    # --- Collect all entry IDs across pages ---
    ids = [item["id"] for item in data.get("items", [])]
    pages = (total + PAGE_SIZE - 1) // PAGE_SIZE

    for page in range(2, pages + 1):
        status, body = api("GET", list_url(base, scope, page), auth)
        if status >= 400:
            print(f"❌ Failed to fetch page {page}: HTTP {status}")
            sys.exit(1)
        ids.extend(item["id"] for item in json.loads(body).get("items", []))

    print(f"Deleting {len(ids)} entries...", flush=True)

    # --- Delete concurrently ---
    start = time.time()
    ok = 0
    fail = 0
    n = len(ids)

    def do_delete(entry_id):
        status, _ = api("DELETE", f"{base}/o/c/forumstatsusers/{entry_id}", auth)
        return entry_id, status < 300

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(do_delete, eid): eid for eid in ids}
        for i, future in enumerate(as_completed(futures), 1):
            entry_id, success = future.result()
            if success:
                ok += 1
            else:
                fail += 1
                print(f"  ❌ Failed to delete {entry_id}")

            if i % 500 == 0 or i == n:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed else i
                eta = (n - i) / rate if rate else 0
                print(f"  {i}/{n}  {rate:.0f}/s  ETA ~{eta:.0f}s", flush=True)

    elapsed = time.time() - start
    print(f"\nDone. Deleted: {ok}  Failed: {fail}  Time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()

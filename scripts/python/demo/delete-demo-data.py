#!/usr/bin/env python3

# SPDX-License-Identifier: LGPL-2.1-or-later
"""
Delete all demo forum data via the Liferay DXP Headless API.

Steps:
  1. Delete all Forum Reply entries (votes auto-deleted via cascade).
  2. Delete all Forum Message entries.
  3. Delete all Forum Category entries.

Usage:
    python3 delete-demo-data.py <siteId> [BASE_URL] [--email EMAIL] [--password PASSWORD]

Defaults:
    BASE_URL: http://localhost:8080
    EMAIL:    test@liferay.com
    PASSWORD: test
"""

import argparse
import base64
import json
import sys
import urllib.error
import urllib.request


def api_request(method, url, auth, data=None):
    """Make an HTTP request and return (status_code, parsed_json_or_None)."""
    headers = {"Authorization": auth, "Accept": "application/json"}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, method=method, headers=headers, data=body)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"_raw": raw[:500]}


def fetch_all_ids(base, path, auth):
    """Page through a collection endpoint and return all item IDs."""
    ids = []
    page = 1
    page_size = 100
    while True:
        url = f"{base}{path}?page={page}&pageSize={page_size}"
        status, body = api_request("GET", url, auth)
        if status >= 300 or not body:
            print(f"  ❌ Failed to list {path}: {status}")
            break
        items = body.get("items", [])
        ids.extend(item["id"] for item in items)
        if len(ids) >= body.get("totalCount", 0):
            break
        page += 1
    return ids


# ─── Step 1: Delete Forum Replies ─────────────────────────────────────────

def delete_replies(base, site_id, auth):
    print("\n═══ Step 1: Deleting Forum Replies ═══")
    ids = fetch_all_ids(base, f"/o/c/forumreplies/scopes/{site_id}", auth)
    if not ids:
        print("  No Forum Replies found.")
        return

    print(f"  Found {len(ids)} replies to delete.")
    deleted = 0
    for reply_id in ids:
        status, _ = api_request("DELETE", f"{base}/o/c/forumreplies/{reply_id}", auth)
        if status < 300:
            deleted += 1
            print(f"  ✅ Deleted reply {reply_id}")
        else:
            print(f"  ❌ Failed to delete reply {reply_id}: {status}")

    print(f"\n  Deleted {deleted}/{len(ids)} replies.")


# ─── Step 2: Delete Forum Messages ────────────────────────────────────────

def delete_messages(base, site_id, auth):
    print("\n═══ Step 2: Deleting Forum Messages ═══")
    ids = fetch_all_ids(base, f"/o/c/forummessages/scopes/{site_id}", auth)
    if not ids:
        print("  No Forum Messages found.")
        return

    print(f"  Found {len(ids)} messages to delete.")
    deleted = 0
    for msg_id in ids:
        status, _ = api_request("DELETE", f"{base}/o/c/forummessages/{msg_id}", auth)
        if status < 300:
            deleted += 1
            print(f"  ✅ Deleted message {msg_id}")
        else:
            print(f"  ❌ Failed to delete message {msg_id}: {status}")

    print(f"\n  Deleted {deleted}/{len(ids)} messages.")


# ─── Step 3: Delete Forum Categories ─────────────────────────────────────

def delete_categories(base, site_id, auth):
    print("\n═══ Step 3: Deleting Forum Categories ═══")
    ids = fetch_all_ids(base, f"/o/c/forumcategories/scopes/{site_id}", auth)
    if not ids:
        print("  No Forum Categories found.")
        return

    print(f"  Found {len(ids)} categories to delete.")
    deleted = 0
    for cat_id in ids:
        status, _ = api_request("DELETE", f"{base}/o/c/forumcategories/{cat_id}", auth)
        if status < 300:
            deleted += 1
            print(f"  ✅ Deleted category {cat_id}")
        else:
            print(f"  ❌ Failed to delete category {cat_id}: {status}")

    print(f"\n  Deleted {deleted}/{len(ids)} categories.")


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Delete all demo forum data via the Liferay Headless API.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("site_id", help="Site (group) ID to scope all entries to")
    parser.add_argument("base_url", nargs="?", default="http://localhost:8080",
                        help="Liferay portal base URL")
    parser.add_argument("--email", default="test@liferay.com",
                        help="Admin email address")
    parser.add_argument("--password", default="test",
                        help="Admin password")
    args = parser.parse_args()

    creds = f"{args.email}:{args.password}"
    auth = "Basic " + base64.b64encode(creds.encode()).decode()
    base = args.base_url.rstrip("/")
    site_id = args.site_id

    print(f"Target: {base}  Site ID: {site_id}")

    delete_replies(base, site_id, auth)
    delete_messages(base, site_id, auth)
    delete_categories(base, site_id, auth)

    print("\n✅ Demo data deletion complete.")


if __name__ == "__main__":
    main()

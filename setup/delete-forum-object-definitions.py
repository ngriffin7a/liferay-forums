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
Delete all Liferay Object Definitions whose name starts with "Forum".

Handles dependency ordering by retrying failed deletions across multiple
passes — leaf objects get deleted first, unblocking parent objects on
subsequent passes.

Usage:
    python3 delete-forum-objects.py [BASE_URL] [--email EMAIL] [--password PASSWORD]

Defaults:
    BASE_URL: http://localhost:8080/o/object-admin/v1.0/object-definitions
    EMAIL:    test@liferay.com
    PASSWORD: test
"""

import argparse
import urllib.request
import json
import time
import base64

PREFIX = "Forum"
MAX_PASSES = 10


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


def main():
    parser = argparse.ArgumentParser(
        description='Delete all Liferay Object Definitions whose name starts with "Forum".',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument('base_url', nargs='?', default='http://localhost:8080/o/object-admin/v1.0/object-definitions', help='Base URL for the object admin API')
    parser.add_argument('--email', default='test@liferay.com', help='Liferay user email address')
    parser.add_argument('--password', default='test', help='Liferay user password')
    args = parser.parse_args()

    _creds = f"{args.email}:{args.password}"
    _b64_creds = base64.b64encode(_creds.encode()).decode()
    auth = f"Basic {_b64_creds}"

    status, body = api("GET", f"{args.base_url}?pageSize=100", auth)
    data = json.loads(body)
    forum_ids = [
        (item["id"], item["name"])
        for item in data.get("items", [])
        if item["name"].startswith(PREFIX)
    ]

    if not forum_ids:
        print("No Forum object definitions found.")
        return

    print(f"Found {len(forum_ids)} Forum objects to delete:")
    for id_, name in forum_ids:
        print(f"  {id_}: {name}")

    remaining = list(forum_ids)
    pass_num = 0
    total_deleted = 0

    while remaining and pass_num < MAX_PASSES:
        pass_num += 1
        print(f"\n--- Pass {pass_num} ({len(remaining)} remaining) ---")
        failed = []
        for id_, name in remaining:
            status, body = api("DELETE", f"{args.base_url}/{id_}", auth)
            if status < 300:
                print(f"  ✅ Deleted {name} (ID: {id_})")
                total_deleted += 1
            else:
                try:
                    err = json.loads(body)
                    msg = err.get("title", err.get("message", body[:200]))
                except Exception:
                    msg = body[:200]
                print(f"  ❌ Failed {name} (ID: {id_}): {status} - {msg}")
                failed.append((id_, name))

        # If no progress was made, reverse the order to try a different
        # dependency resolution path on the next pass.
        if failed and len(failed) == len(remaining):
            remaining = list(reversed(failed))
        else:
            remaining = failed

        if remaining:
            time.sleep(1)

    print(f"\nDeleted: {total_deleted}")
    if remaining:
        print(f"⚠️  Could not delete {len(remaining)} after {MAX_PASSES} passes:")
        for id_, name in remaining:
            print(f"  - {name} (ID: {id_})")
    else:
        print("🎉 All Forum objects deleted!")


if __name__ == "__main__":
    main()

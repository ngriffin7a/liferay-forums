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
Create demo forum data via the Liferay DXP Headless API.

Steps:
  1. Ensure the four default Forum Categories exist (by ERC).
  2. Create demo user accounts and assign "Site Member" role.
  3. Create Forum Messages (with keywords) across categories.
  4. Create Forum Replies on each message by *different* users.

Data files are read from the same directory as this script:
  - categories.json
  - users.json
  - messages.json
  - replies.json

Usage:
    python3 create-demo-data.py <siteId> [BASE_URL] [--email EMAIL] [--password PASSWORD]

Defaults:
    BASE_URL: http://localhost:8080
    EMAIL:    test@liferay.com
    PASSWORD: test
"""

import argparse
import base64
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# ── Resolve data directory relative to this script ───────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = SCRIPT_DIR


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Load external data files ─────────────────────────────────────────────

DEFAULT_CATEGORIES = load_json("categories.json")
DEMO_USERS = load_json("users.json")
DEMO_MESSAGES = load_json("messages.json")
REPLY_POOL = load_json("replies.json")

DEMO_USER_PASSWORD = "ForumDemo2026!"


def api_request(method, url, auth, data=None, impersonate_user_id=None):
    """Make an HTTP request and return (status_code, parsed_json_or_None)."""
    headers = {"Authorization": auth, "Accept": "application/json"}
    if impersonate_user_id is not None:
        headers["X-Liferay-Impersonate-User"] = str(impersonate_user_id)
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


# ─── Step 1: Ensure categories ────────────────────────────────────────────

def ensure_categories(base, site_id, auth):
    """Return dict mapping category ERC → category numeric id."""
    print("\n═══ Step 1: Ensuring default categories exist ═══")
    cat_map = {}
    for cat in DEFAULT_CATEGORIES:
        erc = cat["erc"]
        url = f"{base}/o/c/forumcategories/scopes/{site_id}/by-external-reference-code/{erc}"
        status, body = api_request("GET", url, auth)
        if status < 300 and body and body.get("id"):
            cat_map[erc] = body["id"]
            print(f"  ✅ Exists: {cat['categoryName']} (id={body['id']})")
        else:
            # Create via PUT-by-ERC (upsert)
            payload = {
                "externalReferenceCode": erc,
                "categoryName": cat["categoryName"],
                "categoryName_i18n": {"en_US": cat["categoryName"]},
                "categoryDescription": cat["categoryDescription"],
            }
            url2 = f"{base}/o/c/forumcategories/scopes/{site_id}/by-external-reference-code/{erc}"
            status2, body2 = api_request("PUT", url2, auth, payload)
            if status2 < 300 and body2 and body2.get("id"):
                cat_map[erc] = body2["id"]
                print(f"  ✅ Created: {cat['categoryName']} (id={body2['id']})")
            else:
                # Fallback: POST
                url3 = f"{base}/o/c/forumcategories/scopes/{site_id}"
                payload["externalReferenceCode"] = erc
                status3, body3 = api_request("POST", url3, auth, payload)
                if status3 < 300 and body3 and body3.get("id"):
                    cat_map[erc] = body3["id"]
                    print(f"  ✅ Created (POST): {cat['categoryName']} (id={body3['id']})")
                else:
                    print(f"  ❌ Failed to create {cat['categoryName']}: {status3} — {body3}")
    return cat_map


# ─── Step 2: Create demo users ────────────────────────────────────────────

def ensure_users(base, site_id, auth):
    """Create demo users if they don't exist. Returns list of user dicts with 'id'."""
    print("\n═══ Step 2: Creating demo users ═══")
    users = []
    for u in DEMO_USERS:
        # Check if user exists by email
        filt = urllib.parse.quote(f"emailAddress eq '{u['emailAddress']}'")
        search_url = f"{base}/o/headless-admin-user/v1.0/user-accounts?filter={filt}"
        status, body = api_request("GET", search_url, auth)
        if status < 300 and body and body.get("totalCount", 0) > 0:
            user = body["items"][0]
            users.append(user)
            print(f"  ✅ Exists: {u['givenName']} {u['familyName']} (id={user['id']})")
        else:
            payload = {
                "alternateName": u["screenName"],
                "emailAddress": u["emailAddress"],
                "givenName": u["givenName"],
                "familyName": u["familyName"],
                "password": DEMO_USER_PASSWORD,
            }
            status2, body2 = api_request(
                "POST", f"{base}/o/headless-admin-user/v1.0/user-accounts", auth, payload
            )
            if status2 < 300 and body2 and body2.get("id"):
                users.append(body2)
                print(f"  ✅ Created: {u['givenName']} {u['familyName']} (id={body2['id']})")
            else:
                print(f"  ❌ Failed to create {u['emailAddress']}: {status2} — {body2}")

    # Assign Site Member role
    print("\n  Assigning Site Member role...")
    for user in users:
        uid = user["id"]
        url = f"{base}/o/headless-admin-user/v1.0/sites/{site_id}/user-accounts/{uid}"
        status, _ = api_request("POST", url, auth)
        if status < 300:
            print(f"    ✅ Site Member assigned: {user.get('givenName', '')} {user.get('familyName', '')} (id={uid})")
        elif status == 409 or status == 204:
            print(f"    ✅ Already a member: {user.get('givenName', '')} {user.get('familyName', '')} (id={uid})")
        else:
            # Try alternative endpoint
            alt = f"{base}/api/jsonws/user/add-group-users?groupId={site_id}&userIds={uid}"
            s2, _ = api_request("POST", alt, auth)
            if s2 < 300:
                print(f"    ✅ Site Member assigned (alt): {user.get('givenName', '')} (id={uid})")
            else:
                print(f"    ⚠️  Could not assign Site Member for user {uid}: {status}")

    return users


# ─── Step 3 & 4: Create messages and replies ──────────────────────────────

def create_messages_and_replies(base, site_id, auth, cat_map, users):
    """Create Forum Messages and Forum Replies from JSON data."""
    print("\n═══ Step 3: Creating Forum Messages ═══")
    if not users:
        print("  ❌ No users available — skipping message creation.")
        return

    # Build per-user Basic auth strings keyed by screen name
    user_auth_by_screen = {}
    for u in DEMO_USERS:
        screen = u.get("screenName", u.get("alternateName", ""))
        creds = f"{u['emailAddress']}:{DEMO_USER_PASSWORD}"
        user_auth_by_screen[screen] = "Basic " + base64.b64encode(creds.encode()).decode()

    total = len(DEMO_MESSAGES)
    reply_count = 0
    vote_count = 0

    for idx, msg_def in enumerate(DEMO_MESSAGES):
        cat_erc = msg_def["category"]
        title = msg_def["title"]
        body_html = msg_def["body"]
        keywords = msg_def["keywords"]
        is_question = msg_def.get("question", False)
        author_screen = msg_def.get("author", "")

        cat_id = cat_map.get(cat_erc)
        if not cat_id:
            print(f"  ⚠️  Skipping '{title}' — category {cat_erc} not found")
            continue

        author_auth = user_auth_by_screen.get(author_screen, auth)

        msg_payload = {
            "messageTitle": title,
            "messageTitle_i18n": {"en_US": title},
            "r_categoryMessages_c_forumCategoryId": cat_id,
            "question": is_question,
            "keywords": keywords,
            "viewCount": random.randint(5, 320),
        }

        url = f"{base}/o/c/forummessages/scopes/{site_id}"
        status, msg = api_request("POST", url, author_auth, msg_payload)
        if status >= 300 or not msg or not msg.get("id"):
            print(f"  ❌ Failed to create message '{title}': {status}")
            continue

        msg_id = msg["id"]
        print(f"  ✅ [{idx+1}/{total}] {title}  (id={msg_id}, author={author_screen})")

        # Create OP reply (the message body) as the message author
        op_reply = {
            "r_messageReplies_c_forumMessageId": msg_id,
            "r_categoryReplies_c_forumCategoryId": cat_id,
            "subject": title,
            "subject_i18n": {"en_US": title},
            "body": body_html,
            "format": "html",
        }
        rs, _ = api_request("POST", f"{base}/o/c/forumreplies/scopes/{site_id}", author_auth, op_reply)
        if rs >= 300:
            print(f"    ⚠️  Could not create OP reply for '{title}': {rs}")

        # ── Create replies defined in the JSON ──
        replies_def = msg_def.get("replies", [])
        for reply_def in replies_def:
            reply_idx = reply_def.get("replyIndex", 0)
            reply_body = REPLY_POOL[reply_idx] if reply_idx < len(REPLY_POOL) else REPLY_POOL[0]
            is_answer = reply_def.get("answer", False)
            reply_author_screen = reply_def.get("author", "")
            reply_auth = user_auth_by_screen.get(reply_author_screen, auth)

            reply_payload = {
                "r_messageReplies_c_forumMessageId": msg_id,
                "r_categoryReplies_c_forumCategoryId": cat_id,
                "subject": f"Re: {title}"[:75],
                "subject_i18n": {"en_US": f"Re: {title}"[:75]},
                "body": reply_body,
                "format": "html",
                "answer": is_answer,
            }

            rs, reply_data = api_request(
                "POST", f"{base}/o/c/forumreplies/scopes/{site_id}", reply_auth, reply_payload,
            )
            if rs >= 300 or not reply_data or not reply_data.get("id"):
                print(f"    ⚠️  Reply failed on '{title}': {rs}")
                continue

            reply_id = reply_data["id"]
            reply_count += 1

            # ── Create votes for this reply ──
            upvotes = reply_def.get("upvotes", 0)
            downvotes = reply_def.get("downvotes", 0)
            net_score = upvotes - downvotes

            for _ in range(upvotes):
                vs, _ = api_request(
                    "POST", f"{base}/o/c/forumvotes/scopes/{site_id}", auth,
                    {"r_replyVotes_c_forumReplyId": reply_id, "voteValue": 1},
                )
                if vs < 300:
                    vote_count += 1

            for _ in range(downvotes):
                vs, _ = api_request(
                    "POST", f"{base}/o/c/forumvotes/scopes/{site_id}", auth,
                    {"r_replyVotes_c_forumReplyId": reply_id, "voteValue": -1},
                )
                if vs < 300:
                    vote_count += 1

            # Update the reply's aggregate voteScore
            if net_score != 0:
                api_request(
                    "PATCH", f"{base}/o/c/forumreplies/{reply_id}", auth,
                    {"voteScore": net_score},
                )

        # Small delay to avoid overwhelming the server
        if (idx + 1) % 10 == 0:
            time.sleep(0.5)

    print(f"\n  ✅ Created {reply_count} replies and {vote_count} votes.")


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Create demo forum data via the Liferay Headless API.",
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

    cat_map = ensure_categories(base, site_id, auth)
    if not cat_map:
        print("\n❌ No categories could be created. Aborting.")
        sys.exit(1)

    users = ensure_users(base, site_id, auth)
    if not users:
        print("\n❌ No users could be created. Aborting.")
        sys.exit(1)

    create_messages_and_replies(base, site_id, auth, cat_map, users)

    print("\n🎉 Demo data creation complete!")


if __name__ == "__main__":
    main()

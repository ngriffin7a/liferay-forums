# Liferay Forums

This project is a Fragments and Liferay Objects based replacement for the legacy Message Boards / Questions widgets which are deprecated.

---

## Setup

| File | Description |
| :--- | :--- |
| [forums-folder-object-definitions.json](setup/forums-folder-object-definitions.json) | Liferay Object definitions for all Forum data models (`ForumCategory`, `ForumThread`, `ForumReply`, `ForumVote`, etc.). Import via **Control Panel → Objects → Import Object Folder**. |
| [setup-forum-permissions.groovy](setup/setup-forum-permissions.groovy) | Groovy script that grants the required Object permissions to the Guest and Site Member roles. Run via **Control Panel → Server Administration → Script**. This step is necessary because Liferay Objects has no equivalent to the `<resource-action-mapping>` XML descriptor used by Service Builder to define default permissions — Object permissions must be configured explicitly after import. The Headless REST API does not have endpoints that support this yet. It also sets up a Service Access Policy so that non-authenticated users can invoke the REST APIs in order to see forum threads and replies. |
| [Language_en_US.properties](setup/Language_en_US.properties) | Language key definitions for fragment UI strings. Import via **Control Panel → Configuration → Language Override**. |
| [delete-forum-object-definitions.py](setup/delete-forum-object-definitions.py) | Utility script that deletes all Object definitions whose name starts with `Forum` via the Object Admin REST API. Useful for resetting a dev environment. |

---

## Fragments

| Fragment Name | Folder | Description |
| :--- | :--- | :--- |
| **Forums Categories Admin** | [forums-categories-admin](fragments/forums-categories-admin) | Administration interface for managing forum categories. |
| **Forums Category Grid** | [forums-category-grid](fragments/forums-category-grid) | Displays the main forum categories in a grid layout. |
| **Forums Hero** | [forums-hero](fragments/forums-hero) | Top banner for the forums featuring statistics (like member count) and quick actions. |
| **Forums Moderation** | [forums-moderation](fragments/forums-moderation) | Tools for moderating forum content. |
| **Forums Message Composer** | [forums-message-composer](fragments/forums-message-composer) | Modal composer for creating and editing forum threads and replies. |
| **Forums Related Topics** | [forums-related-topics](fragments/forums-related-topics) | Displays a list of topics related to the currently viewed thread. |
| **Forums Thread Detail** | [forums-thread-detail](fragments/forums-thread-detail) | Detailed view of a single forum thread, including its replies and engagement metrics. |
| **Forums Thread List** | [forums-thread-list](fragments/forums-thread-list) | Lists forum threads, typically used for main category views or recent activity. |

---

## Page Layout and Fragment Placement

The forums application is assembled using a combination of standard pages and Display Page Templates.

| Page | Fragments | Notes |
| :--- | :--- | :--- |
| **Forums** | `forums-hero`, `forums-category-grid` | Main entry point for the forums. |
| **Forum Threads** | `forums-thread-list`, `forums-message-composer` | Typically hidden from page navigation. |
| **Forum Category Admin** | `forums-categories-admin` | Restrict access to the Administrator role. |
| **Forum Moderation** | `forums-moderation` | Restrict access to the Administrator role. |

---

## Display Page Templates

The following Display Page Templates must be imported rather than built manually.

| Display Page Template | Folder | Mapped Object | Fragments |
| :--- | :--- | :--- | :--- |
| **Forum Thread** | [forum-thread](display-page-templates/forum-thread) | `ForumThread` | `forums-thread-detail`, `forums-related-topics` |
| **Forum Reply** | [forum-reply](display-page-templates/forum-reply) | `ForumReply` | `forums-thread-detail`, `forums-related-topics` |

The `forums-thread-detail` and `forums-related-topics` fragments each contain hidden `div` elements used to expose ERCs as mappable fields. These are visible while editing the Display Page Template in the page editor, but are not rendered to end-users when the page is viewed. After importing a Display Page Template, open it in the page editor and map each ERC field to the corresponding field on the mapped Object.

```html
<!-- Mappable Thread ERC fields — visible in the Content Page Editor
     for mapping, hidden at runtime -->
<div
    id="forumsDetailERC"
    data-lfr-editable-id="forumsDetailERC"
    data-lfr-editable-type="text"
    style="display: none;">Mappable Thread ERC</div>
<div
    id="forumsDetailReplyERC"
    data-lfr-editable-id="forumsDetailReplyERC"
    data-lfr-editable-type="text"
    style="display: none;">Mappable Reply ERC</div>
```

- **Mappable Thread ERC** — map this field only when the fragment is placed in the **Forum Thread** Display Page Template.
- **Mappable Reply ERC** — map this field only when the fragment is placed in the **Forum Reply** Display Page Template.

---

## Known Limitations (Fragments)

### View Count Not Incremented for Guest Users

The `forums-thread-detail` fragment PATCHes the `viewCount` field on `ForumThread` objects only for authenticated users. Guest views are silently skipped because the Liferay Object REST API returns `403 Forbidden` for unauthenticated PATCH requests.

**Option:** Grant the Guest role `update` permission on ForumThread objects via the Object's permissions configuration. However, the preferred solution is a dedicated endpoint in a Spring Boot Client Extension that accepts a `threadId` and increments `viewCount` with its own service credentials — keeping the Object's permissions locked down.

### Ban Enforcement Is UI-Only

When a user is banned (a `ForumBan` Object entry exists for their user ID in the site scope), the fragments detect this at page load by querying `GET /o/c/forumbans/scopes/{groupId}?filter=banUserId eq {userId}`. If a ban is found, the UI is locked down: the submit button is disabled, compose buttons are hidden, and an inline warning is shown. This is purely client-side — the REST endpoints that create and update content (`POST /o/c/forumthreads/`, `POST /o/c/forumreplies/`, `PATCH /o/c/forumthreads/{id}`, `PATCH /o/c/forumreplies/{id}`) have no knowledge of the `ForumBan` collection and will accept requests from a banned user if called directly.

**Why the legacy portlets don't have this gap:** The legacy Message Boards portlets enforce bans at the Liferay permission framework layer (`MBPortletResourcePermissionLogic`), which calls `MBBanLocalService.hasBan()` on every permission check regardless of the calling path (web UI, REST API, or direct service invocation). Custom Liferay Objects have no equivalent hook into that permission logic.

**Why this can't be fixed with built-in Object features:** Object Actions all fire after the entry is already committed (there is no pre-create trigger that can abort creation). Object Validation rules use the Expression Builder, which is limited to the entry's own field values and cannot query other Object collections or access current user context. Groovy script actions — which could perform the check — are not available on Liferay SaaS.

**The only realistic server-side option: Microservice Client Extension**

A Spring Boot Microservice Client Extension can be registered as an Object Action webhook on both `ForumThread` and `ForumReply`, triggered on the `On After Add` event. It would:

1. Receive the Object Action payload, which includes the `creatorId` (the user ID of the entry author) and the `groupId` (site scope).
2. Call `GET /o/c/forumbans/scopes/{groupId}?filter=banUserId eq {creatorId}&pageSize=1` using service credentials to check for a ban record.
3. If a ban record exists, immediately call `DELETE /o/c/forumthreads/{entryId}` or `DELETE /o/c/forumreplies/{entryId}` to remove the entry.

There is an unavoidable brief window (milliseconds to low seconds depending on load) between the entry being created and the microservice deleting it. In practice this is acceptable given that banning is rare and the moderation fragment provides a backstop for any content that appears during that window.

### "Top Replies" Implemented as "Recent Activity"

The "Recent Activity" tab (formerly "Top Replies") sorts threads using `lastPostDate:desc`. This functions as a "Recently Active" feed rather than filtering for the highest volume of total replies. A new thread with 1 reply will surface above an older thread with 100 replies.

**Option:** If a true "Top Replied" filter is desired, the sorting criteria must be changed to target a `replyCount` metric. The Liferay Object definition would need an aggregated integer field for total replies that can be passed to the OData `sort` parameter (e.g., `sort=replyCount:desc`), or rely on a Client Extension to dynamically aggregate and sort this information.

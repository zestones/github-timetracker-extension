# Storage Space Analysis — GitHub Time Tracker

## Budget

`chrome.storage.local` has a hard limit of **5,242,880 bytes (5 MB)**.
There is no per-key limit, but the total across all keys must stay under 5 MB.

---

## Storage Keys Inventory

All data is stored via `chrome.storage.local`. Below is every key, its shape, growth pattern, and estimated size.

### Fixed-size keys (bounded)

| Key             | Shape                         | Max Size | Notes                                           |
|-----------------|-------------------------------|----------|-------------------------------------------------|
| `schemaVersion` | `number`                      | ~2 B     | Static                                          |
| `githubToken`   | `string`                      | ~100 B   | Single PAT (`ghp_...` = 40-255 chars)           |
| `activeIssue`   | `string \| null`              | ~60 B    | Single issue URL, cleared on stop               |
| `startTime`     | `string \| null`              | ~30 B    | ISO 8601 timestamp, cleared on stop             |
| `autoSync`      | `boolean`                     | ~5 B     |                                                 |
| `theme`         | `string`                      | ~10 B    | `"system"`, `"light"`, or `"dark"`              |
| `cachedUser`    | `{ login, avatar_url, name }` | ~300 B   | Wrapped in cache envelope (+`fetchedAt`, `ttl`) |
| `pinnedRepos`   | `[{ fullName }]`              | ~1 KB    | Practical ceiling: ~20 pinned repos             |

**Subtotal: ~1.5 KB** — negligible.

### Unbounded keys (grow with usage)

#### 1. `trackedTimes` — **primary concern**

```json
{
  "issueUrl": "/owner/repo/issues/123",
  "title": "(owner) repo | Fix the login bug | #123",
  "seconds": 3600,
  "date": "2026-03-13"
}
```

**Per-entry size:** ~140–180 bytes (depending on title/URL length).
Using a conservative average of **160 bytes**:

| Entries | Size      | Usage scenario           |
|---------|-----------|--------------------------|
| 1,000   | ~156 KB   | Casual user, ~1 year     |
| 5,000   | ~781 KB   | Active user, ~2 years    |
| 10,000  | ~1.5 MB   | Power user, ~3 years     |
| 20,000  | ~3.1 MB   | Heavy team use, ~4 years |
| 33,000  | **~5 MB** | **Hard limit reached**   |

**Projection at 5 sessions/day:** ~1,825/year → **~2.8 years** to hit 1 MB.
**Projection at 20 sessions/day:** ~7,300/year → **~4.5 years** to hit 5 MB.

> JSON serialization overhead (keys repeated per entry) adds ~15-20% to the raw payload. The figures above include this overhead.

#### 2. `everyoneData` — **secondary concern**

Same shape as `trackedTimes` + a `user` field (~10-20 bytes extra). This stores aggregated data from all team members across all pinned repos.

Worst case: if 5 team members each have 1,000 entries across pinned repos = 5,000 entries × ~180 bytes = **~880 KB**.

This key is **fully replaced** on each "Everyone" fetch (not appended), so it doesn't grow unboundedly. But it can be large in a single snapshot.

#### 3. `commentIds` — **minor concern**

```json
{ "username:/owner/repo/issues/123": 987654321 }
```

**Per-entry:** ~55 bytes. One entry per unique issue ever tracked.

| Issues tracked | Size    |
|----------------|---------|
| 100            | ~5.4 KB |
| 1,000          | ~54 KB  |
| 5,000          | ~268 KB |

Growth: linear with unique issues. Capped by the number of GitHub issues you interact with (unlikely to exceed a few thousand).

#### 4. `issues` — **minor concern**

```json
{ "url": "/owner/repo/issues/123", "title": "(owner) repo | Fix bug | #123" }
```

**Per-entry:** ~100 bytes. One entry per unique issue tracked.

Same growth ceiling as `commentIds`.

#### 5. `cache:issues:<repo>` — **self-pruning**

Cached issue lists per pinned repo. Entries expire after 5 minutes (`CACHE_TTL`). Each repo's cache is ~50-200 KB depending on open issue count, but it's transient and automatically invalidated.

With 10 pinned repos: worst case ~2 MB of cache, but only for 5 minutes at a time.

---

## Total Budget Allocation

Assuming a **heavy user** after 2 years (5,000 tracked sessions, 500 unique issues, 5 pinned repos, 5 team members):

| Key                          | Estimated Size |
|------------------------------|----------------|
| `trackedTimes`               | ~781 KB        |
| `everyoneData`               | ~880 KB        |
| `commentIds`                 | ~27 KB         |
| `issues`                     | ~49 KB         |
| `cache:issues:*` (transient) | ~500 KB        |
| All fixed keys               | ~1.5 KB        |
| **Total**                    | **~2.2 MB**    |

**Headroom: ~2.8 MB remaining.** Comfortable for 2 years of heavy use.

---

## When It Becomes a Problem

The 5 MB limit becomes a real risk when:

1. **`trackedTimes` exceeds ~15,000 entries** (~2.3 MB) — around 3-4 years for an active user.
2. **`everyoneData` is large AND `trackedTimes` is large** — combined pressure.
3. **Issue cache spikes** while the above are already heavy — temporary but could push over.

## Mitigation Strategies (Future)

These are not implemented yet. They should be considered when the extension matures:

### Option A: Archive old entries (recommended)

- On each `stopTimer`, check `trackedTimes.length`.
- If > 10,000 entries, archive entries older than 6 months.
- "Archive" = remove from `trackedTimes` (data still exists on GitHub comments).
- Show a notification: "Older entries archived. Use Export or Sync to recover."

### Option B: Aggregate old entries

- Entries older than 3 months get collapsed: multiple sessions per issue per day → single summed entry.
- Reduces entry count without losing totals.
- Downside: loses per-session granularity.

### Option C: Prune `everyoneData` on store

- Only keep the last 30 days of everyone data.
- Older data can be re-fetched from GitHub comments on demand.

### Option D: Move to IndexedDB

- `chrome.storage.local` has a 5 MB cap; IndexedDB has effectively unlimited storage.
- Requires a migration and a different async API.
- Significant refactor — only worth it if other options are exhausted.

---

## Current Status

| Metric               | Value                                      |
|----------------------|--------------------------------------------|
| Schema version       | 1                                          |
| Storage pruning      | None                                       |
| Export available     | CSV, JSON                                  |
| Sync recovery        | GitHub comments contain all per-issue data |
| Estimated safe usage | **3+ years** before any action needed      |

No immediate action required. The `schemaVersion` key (added in v1.0.2) ensures future migrations can be applied cleanly when a pruning strategy is implemented.

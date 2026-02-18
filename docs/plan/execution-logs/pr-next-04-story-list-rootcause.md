# PR-NEXT-04: Story List Root Cause & Verification

## STEP 1 — Data Source Evidence

### Story list screen
- **File**: `app/(tabs)/story/index.tsx`
- **Calls**: `listStories({ limit: 50, accessToken })` from `src/services/stories.ts`
- **Traces to**: `getStoryList()` in `features/story/api/queries.ts`

### Actual data source
- **getStoryList** (lines 68–108) fetches from: **`public.stories`** (REST `/rest/v1/stories`)
- **Does NOT use** `best_stories_v` for the main list
- Filter: `story_status=eq.approved`, `is_blocked=eq.false`
- Order: `created_at.desc`

### best_stories_v usage
- **getBestStories** uses `best_stories_v` — used for "Best" section (e.g. Home), NOT the main Story list

**Conclusion**: The main Story list already uses `stories` with `story_status='approved'`. If approved stories are missing, the cause is likely migration/RLS, not the data source.

---

## STEP 2 — Remote DB Verification Checklist

Run these in Supabase SQL Editor (or `psql`) against the remote DB:

### 1) Confirm approved story row exists
```sql
-- Replace <APPROVED_STORY_ID> with an ID you approved in admin
select id, story_status, is_blocked, created_at
from public.stories
where id = '<APPROVED_STORY_ID>';
```
**Expected**: One row with `story_status='approved'`, `is_blocked=false`.

### 2) Confirm best_stories_v returns rows (after migration 202602190001)
```sql
select id, title, created_at, vote_count
from public.best_stories_v
order by vote_count desc, created_at desc
limit 20;
```
**Expected**: Approved stories only (0-vote stories included if migration applied).

### 3) Confirm main list query equivalent
```sql
select id, story_status, created_at, title
from public.stories
where story_status = 'approved'
  and is_blocked = false
order by created_at desc
limit 20;
```
**Expected**: All approved, non-blocked stories. If this returns rows but the app list is empty, check RLS or REST/API layer.

### 4) If best_stories_v returns nothing but stories query returns rows
→ Do not use `best_stories_v` as the main list source. The main list must use `stories` (already implemented).

---

## STEP 6 — Verification Checklist

1. [ ] Approve a story as admin
2. [ ] Open Story list as normal user
3. [ ] Newly approved story appears (even with 0 votes)
4. [ ] No 404/NOT FOUND errors
5. [ ] Pending stories not visible in public list

---

## Migration dependency
- `story_status` column: `202602180001_launch_admin_approval.sql`
- `best_stories_v` with `story_status`: `202602190001_story_approval_visibility.sql`

Ensure both are applied: `supabase db push` or run migrations.

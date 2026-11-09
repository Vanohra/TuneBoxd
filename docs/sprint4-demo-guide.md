# Sprint 4 demo guide

A walkthrough of everything added in Sprint 4, in an order that tells a story, with the
SQL to prove each step reached the database. Features are numbered as in the proposal
table (#10, #13–19), and the client requirements as CR-01 to CR-03.

Total time: about 10–12 minutes.

---

## 1. Before the demo (do this 15 minutes early)

1. **Wake the site.** Render's free instance sleeps after inactivity and takes about 50 seconds
   to wake. Open https://tuneboxd.onrender.com a few minutes before you start.
2. **Two browser windows:**
   - **Window A** (normal): you, the **admin**.
   - **Window B** (incognito/private): a second account, e.g. `demo_listener`. Sign it up now.
3. **Make yourself admin** (see section 2). Then log out and back in, and check that **Admin** appears in the sidebar.
4. **Give both accounts some history** so the stats and recommendations have something to show:
   - In both windows, open 3–4 albums and use **Write a Review** (give stars) and **Add to Diary**.
     Pick some albums in common, e.g. both rate the same album 5 stars, and window B also rates
     another album highly. That shared taste is what drives recommendations.
   - In Window A, log 6+ diary entries on different dates (the date picker allows past dates)
     so the monthly and weekday charts have bars.
5. **AI text (optional):** if `GEMINI_API_KEY` is set in Render and the Gemini version is
   deployed, For You shows "written by AI (Google Gemini)". Without it, the same features
   run on TuneBoxd's built-in rules. Both are fine to demo; say which one you're showing.
6. **Open MySQL Workbench** connected to the RDS database `music_review_app`, with
   the queries from section 4 pasted into a tab. Your IP must be allowed in the
   `tuneboxd-team-ips` security group (see `docs/team-handoff.md`, A4).

> Logins are kept in server memory, so every redeploy logs everyone out. Don't redeploy right
> before the demo.

---

## 2. Making yourself admin

There's deliberately no button to make the first admin (otherwise anyone could). Use either option.

**Option A: the script** (from the repo folder on your computer):

```bash
npm --prefix backend run make-admin -- YOUR_USERNAME
```

To undo it, add `--revoke` at the end of the same command.

**Option B: SQL in Workbench:**

```sql
UPDATE users SET role = 'admin' WHERE username = 'YOUR_USERNAME';
SELECT username, role, account_status FROM users WHERE username = 'YOUR_USERNAME';
```

Then **log out and log back in** on the site, and **Admin** appears in the sidebar. Once you're
an admin you can promote others from **Admin → Accounts → Make admin**.

---

## 3. The demo, step by step

### Step 1: Custom lists (#10) with privacy (#16, CR-01) (~2 min)

**Window A (you):**
1. Sidebar → **Lists** → **New List**. Title "Rainy day records", description, keep **Public**. **Create List**.
2. Search an album (e.g. *In Rainbows*), open it, click **Add to List**, and tick "Rainy day records".
   Add a song from the album's tracklist the same way. This shows that lists hold albums *and* songs.
3. Go back to the list: use the **↑ ↓ arrows** to reorder and the trash icon to remove an item. **Edit** shows the title/description/visibility form.
4. Make a second list, "Guilty pleasures", set to **Private** (lock icon). Add one album.

**Show the privacy (CR-01):**
5. Copy the private list's URL (`/lists/<id>`) and open it in **Window B**: "List not found".
   Private lists don't even reveal that they exist.
6. In Window B, open your profile (`/u/YOUR_USERNAME?tab=lists`): only the public list shows.
   The **Lists** count on the profile header counts public lists only for visitors.
7. Diary visibility (also CR-01): Window A → **My Diary** → set **Private**. Window B → your
   profile's **Diary** tab: "This diary is private". Set it back to **Public** afterwards.

**SQL:** queries **Q1** and **Q2** (lists and their items in order), **Q8** (diary privacy).

### Step 2: Reporting a review (#17, CR-02) (~1 min)

**Window B (demo_listener):**
1. Open an album that **you** (Window A) reviewed and find your review.
2. Click **Report** under it, choose a reason (e.g. *Spam or advertising*) and add a detail. **Send Report**.
3. Click Report again: "You've already reported this review". Each person can report a review only once.
4. On their **own** reviews there's no Report button (you can't report yourself).

**SQL:** **Q3** shows the report with status `pending`.

### Step 3: Admin moderation (#18) (~2 min)

**Window A (admin):**
1. Sidebar → **Admin** → **Reports**. The pending report shows the reason, reporter, details and the review text.
2. Click **Remove review**. Then show in Window B that the review is gone from the album
   page, the home feed and the author's profile.
3. Filter **Removed**, click **Restore review**, and it's back everywhere.
4. Optionally report it again from a third account and click **Dismiss report** (the review stays up).

**SQL:** run **Q3** again: the status went `pending` → `removed` → `dismissed`, and `handled_by` / `reviewed_at` are filled in.

### Step 4: Admin account management (#15) (~1.5 min)

**Window A (admin):** **Admin → Accounts**.
1. Search `demo_listener`. Point out the review count and the **Flagged** count.
2. Click **Suspend** → **Confirm**. In **Window B**, refresh: they're logged out, and logging in
   says the account is suspended. Their reviews and comments are hidden while suspended.
3. **Reactivate** them, and they can log in again.
4. Point out the safety rails: on your own row it says **You** (you can't suspend or demote
   yourself), and the last active admin can't be removed.
5. Also show that only admins get in: in Window B, visit `/admin` and it says "Administrators only".
   The server re-checks the role from the database on every request, not just in the UI.

**SQL:** **Q4** (roles and suspended accounts).

### Step 5: Listening statistics (#19, CR-03) (~1.5 min)

**Window A:** sidebar → **Stats**.
1. Top tiles: diary entries, **distinct albums logged**, artists, average rating.
2. **Diary entries per month (last 12 months)**: hover a bar for the exact number, or click **Show table**.
3. **Most logged artists** ranking and **Listens by day of the week**.
4. Privacy again: the same stats appear on your profile's **Stats** tab, and they follow the
   diary setting. Make the diary private and Window B sees "These statistics are private".

**SQL:** **Q5** (distinct albums), **Q6** (top artists), **Q7** (monthly counts). The numbers match the page.

### Step 6: AI recommendations (#13) and summaries (#14) (~2 min)

**Window A:** sidebar → **For You**.
1. **Recommended for you**: each album has a short "why". Explain how they're chosen:
   people who loved the same albums as you, people you follow, more from your top artists,
   and the community's top-rated albums. Albums you've already rated, logged or listed are never recommended.
   With the Gemini key, the explanations are written by AI; the footnote says so.
2. Click **Refresh** to regenerate them.
3. **Listening & review summaries**: pick **Last 30 days** (or set dates) → **Generate Summary**.
   It recaps what you logged, your top artists, replays, busiest day, reviews and average rating.
   Summaries are saved and private to you; the trash icon deletes one.

**SQL:** **Q9** (saved recommendations) and **Q10** (saved summaries).

### Step 7: The AI features (~3 min)

Needs the latest deploy and `GEMINI_API_KEY` in Render.

1. **Ask AI** (sidebar): click an example like *"Moody indie albums for a rainy night, like Radiohead"*
   or type your own. It takes about 10 seconds. Explain: Gemini suggests albums, and TuneBoxd checks
   each one on MusicBrainz, so only real albums appear, each with a reason. Albums you already
   know are tagged "In your history". Click one to open its page.
2. **Review digest:** open an album with 2+ reviews. At the top of Reviews, "What listeners are saying"
   summarizes all the reviews: the overall mood, what was praised and what was criticized.
3. **AI moderation assistant:** in Window B, report a spammy review. In Window A, go to **Admin → Reports**:
   the AI has already read it and shows a verdict (e.g. *Likely spam*), a severity score, a suggested
   action and an explanation. Switch **Sort** to *Most serious first (AI)*. Stress that the AI only
   advises and the admin still decides.

**SQL:** **Q11** (AI assessments) and **Q12** (review digests).

### Closing line

> "Every feature in the client requirements table is now implemented and stored in our RDS
> database. Lists and diaries have public/private controls (CR-01), reviews can be reported and
> moderated by admins (CR-02), and users get listening statistics from their diary (CR-03)."

---

## 4. SQL queries for Workbench

Run this first. `USE` picks the database (without it Workbench says "Error Code: 1046. No
database selected"), and `@me` makes every query use your account:

```sql
USE music_review_app;
SET @me = 'YOUR_USERNAME';
```

**Q1. Lists, owner, visibility and item count (#10, #16)**

```sql
SELECT l.list_id, u.username AS owner, l.title,
       IF(l.is_public, 'public', 'private') AS visibility,
       (SELECT COUNT(*) FROM list_albums la WHERE la.list_id = l.list_id)
     + (SELECT COUNT(*) FROM list_songs  ls WHERE ls.list_id = l.list_id) AS items,
       l.updated_at
FROM lists l
JOIN users u ON u.user_id = l.user_id
ORDER BY l.updated_at DESC;
```

**Q2. Items in one list, in the order you arranged them** (put a list_id from Q1 in the `WHERE`)

```sql
SELECT x.position,
       IF(x.album_id IS NULL, 'song', 'album') AS type,
       COALESCE(al.title, s.title) AS title,
       COALESCE(ala.name, sa.name) AS artist,
       x.added_at
FROM (
  SELECT list_id, album_id, NULL AS song_id, position, added_at FROM list_albums
  UNION ALL
  SELECT list_id, NULL, song_id, position, added_at FROM list_songs
) x
LEFT JOIN albums  al  ON al.album_id  = x.album_id
LEFT JOIN artists ala ON ala.artist_id = al.artist_id
LEFT JOIN songs   s   ON s.song_id    = x.song_id
LEFT JOIN artists sa  ON sa.artist_id  = s.artist_id
WHERE x.list_id = 1          -- change to your list_id
ORDER BY x.position;
```

**Q3. Review reports and what the admin did (#17, #18)**

```sql
SELECT rr.report_id, rr.reason, rr.status,
       rep.username AS reported_by,
       au.username  AS review_author,
       LEFT(r.review_text, 60) AS review,
       mo.username  AS handled_by,
       rr.created_at, rr.reviewed_at
FROM review_reports rr
JOIN reviews r  ON r.review_id = rr.review_id
JOIN users au   ON au.user_id  = r.user_id
JOIN users rep  ON rep.user_id = rr.reported_by
LEFT JOIN users mo ON mo.user_id = rr.reviewed_by
ORDER BY rr.created_at DESC;
```

**Q4. Admins and suspended accounts (#15)**

```sql
SELECT user_id, username, role, account_status, created_at
FROM users
WHERE role = 'admin' OR account_status = 'suspended'
ORDER BY role, username;
```

**Q5. Distinct albums logged and totals (#19)**

```sql
SELECT COUNT(*) AS diary_entries,
       COUNT(DISTINCT d.album_id) AS distinct_albums,
       COUNT(DISTINCT d.song_id)  AS distinct_songs,
       COUNT(DISTINCT DATE(d.listened_at)) AS active_days
FROM diary_entries d
JOIN users u ON u.user_id = d.user_id
WHERE u.username = @me;
```

**Q6. Most frequently logged artists (#19)**

```sql
SELECT ar.name AS artist, COUNT(*) AS times_logged
FROM diary_entries d
JOIN users u ON u.user_id = d.user_id
LEFT JOIN albums al ON al.album_id = d.album_id
LEFT JOIN songs  s  ON s.song_id  = d.song_id
JOIN artists ar ON ar.artist_id = COALESCE(al.artist_id, s.artist_id)
WHERE u.username = @me
GROUP BY ar.artist_id, ar.name
ORDER BY times_logged DESC
LIMIT 10;
```

**Q7. Diary entries per month (#19)**

```sql
SELECT DATE_FORMAT(d.listened_at, '%Y-%m') AS month, COUNT(*) AS entries
FROM diary_entries d
JOIN users u ON u.user_id = d.user_id
WHERE u.username = @me
  AND d.listened_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
GROUP BY month
ORDER BY month;
```

**Q8. Diary visibility settings (CR-01)**

```sql
SELECT u.username, COALESCE(s.diary_visibility, 'public') AS diary_visibility
FROM users u
LEFT JOIN user_settings s ON s.user_id = u.user_id
ORDER BY u.username;
```

**Q9. Saved recommendations (#13)**

```sql
SELECT rec.recommendation_id, al.title AS album, ar.name AS artist,
       rec.reason, rec.generated_at
FROM recommendations rec
JOIN users u    ON u.user_id   = rec.user_id
JOIN albums al  ON al.album_id = rec.album_id
JOIN artists ar ON ar.artist_id = al.artist_id
WHERE u.username = @me
ORDER BY rec.recommendation_id;
```

**Q10. Saved listening summaries (#14)**

```sql
SELECT ls.summary_id, ls.period_start, ls.period_end,
       LEFT(ls.summary_text, 120) AS summary_preview, ls.generated_at
FROM listening_summaries ls
JOIN users u ON u.user_id = ls.user_id
WHERE u.username = @me
ORDER BY ls.generated_at DESC;
```

---

**Q11. AI moderation assessments**

```sql
SELECT a.review_id, a.verdict, a.severity, a.suggested_action, a.explanation, a.analyzed_at
FROM review_ai_assessments a
ORDER BY a.analyzed_at DESC;
```

**Q12. AI review digests**

```sql
SELECT COALESCE(al.title, s.title) AS reviewed_item, d.overall_sentiment, d.review_count,
       LEFT(d.summary_text, 100) AS summary_preview, d.generated_at
FROM review_digests d
LEFT JOIN albums al ON al.album_id = d.album_id
LEFT JOIN songs  s  ON s.song_id   = d.song_id
ORDER BY d.generated_at DESC;
```

---

## 5. If something goes wrong

| What you see | Fix |
| --- | --- |
| Site takes ~50 s to load | Free instance waking up. Open it early. |
| No **Admin** link after promoting yourself | Log out and back in. |
| "Nothing to recommend yet" | You've already rated/logged every album others liked. Have Window B rate a new album 4–5 stars, then **Refresh**. |
| Summary says you logged nothing | Pick a period that includes your diary dates. |
| Summary/recommendation text looks like a template | No Gemini key or quota hit. It still works; just say it's the rule-based mode. |
| Ask AI says "isn't switched on" / no digest / no AI panel | `GEMINI_API_KEY` missing in Render, or the latest code isn't deployed. |
| Ask AI says "asked a lot this hour" | 15 requests per user per hour (protects the free quota). Use another account. |
| Workbench can't connect (timeout) | Add your current IP in the `tuneboxd-team-ips` security group. |

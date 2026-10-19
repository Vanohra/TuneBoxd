# Sprint 3: music, reviews, diary and comments

This sprint adds four use cases on top of the Sprint 2 account system:

1. **Album pages**: search MusicBrainz, then open an album with its artwork, tracklist, genres, TuneBoxd average rating and reviews.
2. **Reviews**: write, rate (0.5–5 stars), edit and delete your own reviews of albums or songs.
3. **Listening diary**: log listens with a date and notes; edit or delete them; make your diary public or private.
4. **Comments**: comment on reviews; edit or delete your own comments.

## Architecture

```
React (frontend/)  ──/api/*──▶  Express (backend/)  ──▶  MySQL on RDS   (users, reviews, ratings, comments, diary...)
                                      │
                                      └──▶  MusicBrainz API (metadata)   rate-limited queue + cache
                                      └──▶  Cover Art Archive (artwork)  cached
```

The browser only talks to our Express API. The backend calls MusicBrainz, so
the User-Agent, rate limiting and caching all happen in one place.
(`<img>` tags load cover images straight from `coverartarchive.org`, the way
Cover Art Archive is meant to be used; no API data comes from there.)

MusicBrainz supplies **music metadata**. MySQL stays the **source of truth for
everything users create**.

## MusicBrainz → MySQL mapping

| TuneBoxd | MusicBrainz entity | MySQL row | `external_id` |
| -------- | ------------------ | --------- | ------------- |
| Artist   | artist             | `artists` | artist MBID   |
| Album    | **release group**  | `albums`  | release-group MBID |
| Song     | recording          | `songs`   | recording MBID |

All rows use `external_source = 'musicbrainz'`. The existing
`UNIQUE (external_source, external_id)` keys guarantee one local row per MBID.

**Why release groups?** MusicBrainz stores each edition (CD, vinyl, remaster,
country) as a separate *release*. A *release group* is the album as a whole.
Using it means everyone's reviews of *In Rainbows* land on one album, whichever
edition they own. The tracklist shown comes from one representative release:
the earliest official release with an exact date.

### Find-or-create flow (`musicService.ensureLocalAlbum` / `ensureLocalSong`)

When a user reviews or logs something:

1. The backend validates the MBID (UUID format), then looks it up on MusicBrainz (cached). That proves it exists; unknown IDs give `404`.
2. In one transaction it upserts the artist, then the album (or the song and its album):
   `INSERT ... ON DUPLICATE KEY UPDATE album_id = LAST_INSERT_ID(album_id)`.
   This is idempotent and race-free: two users saving the same album at the same moment get the same `album_id`.
3. The review or diary entry is inserted with that local ID.
4. If MusicBrainz is down but the album is already in MySQL, the existing row is used.

Album pages read reviews by MBID: `albums.external_id → album_id → reviews`.
An album nobody has reviewed yet has no local row and simply shows "No reviews yet".

## Rate limiting, caching and errors (`services/musicBrainzClient.js`)

- **Throttle:** one shared queue starts at most one MusicBrainz request every 1.1 s (MusicBrainz allows 1/s for anonymous clients). If more than 20 requests are waiting, new ones get `503 "Music search is busy"` so nobody waits 20+ seconds.
- **Backoff:** a MusicBrainz `503` (rate limited) or `429` pushes the queue back 2 s, then 4 s, before giving up with a friendly `503`.
- **Cache:** in memory, up to 500 responses. Searches are kept 10 min and lookups 6 h. Identical in-flight requests share one call. Cover Art Archive results are kept 24 h.
- **User-Agent:** `TuneBoxd/0.1.0 ( <MUSICBRAINZ_CONTACT or the GitHub URL> )`.
- **Errors:** invalid ID gives `400`; unknown ID gives `404`; timeout or network failure or MusicBrainz down gives `503 "MusicBrainz is temporarily unavailable"`. A missing tracklist or missing artwork never breaks the page (the tracklist shows a message and the cover shows a vinyl placeholder). Partial dates such as `"2007"` are kept for display but stored as `NULL` in `albums.release_date` (a DATE column).
- **Search:** uses MusicBrainz's `dismax=true` mode, so plain words match titles *and* artist names ("ok computer radiohead") and user input is never parsed as Lucene query syntax.

## Database usage

All four features use tables that already existed in `music_review_app`.
**One additive migration** was needed:
[`database/migrations/001_sprint3_diary_updated_at.sql`](../database/migrations/001_sprint3_diary_updated_at.sql)
adds a nullable `diary_entries.updated_at` so edited entries record when they changed.
It is safe to re-run (`npm --prefix backend run migrate`).

| Use case | Tables |
| -------- | ------ |
| Album pages | `artists`, `albums`, `songs`, `reviews`, `ratings` |
| Reviews | `reviews` (text, timestamps) + `ratings` (score) + `albums`/`songs`, `users` |
| Diary | `diary_entries`, `user_settings.diary_visibility`, `albums`/`songs`, `users` |
| Comments | `comments`, `reviews`, `users` |
| Moderation (read only) | `review_reports.status = 'removed'` hides a review |

Design decisions:

- **Ratings stay in `ratings`.** The schema keeps scores separate from review text. A review is saved as review + rating in one transaction (and deleted together). The existing `UNIQUE (user_id, album_id)` keys on both tables mean one review per user per album; a second attempt gets `409` and the UI offers "Edit Your Review".
- **Rating scale:** 0.5–5.0 in half-star steps, matching `chk_rating_score` and `DECIMAL(2,1)`.
- **Diary privacy is diary-level**, using the existing `user_settings.diary_visibility` (default `public`). The check runs in `diaryService`: a private diary returns `403` to everyone except its owner, and its entry count is hidden from profile stats.
- **Listening date ≠ creation time.** `listened_at` holds the day the user picked (stored at midnight, read back as `YYYY-MM-DD`); `created_at`/`updated_at` record when the row was written. No unique key, so the same album can be logged on many days.
- **Edits never touch `created_at`**; `updated_at` is set explicitly on every edit.
- **Removed reviews** (a moderator set a report to `removed`) are excluded from every query, can't be edited, and can't be commented on. Reviews and comments from suspended users are hidden too.
- **No orphans:** `comments.review_id ON DELETE CASCADE` deletes a review's comments with it.

## API added in Sprint 3

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/api/music/search?query=&type=album\|artist\|song&page=` | No | MusicBrainz search |
| GET | `/api/music/albums/:mbid` | No | Album details, tracklist, cover, genres |
| GET | `/api/music/albums/:mbid/reviews` | No | Reviews + `{ averageRating, ratingCount, reviewCount }` from MySQL |
| GET | `/api/music/artists/:mbid` | No | Artist + albums/EPs |
| GET | `/api/music/songs/:mbid` | No | Song (recording) details |
| GET | `/api/music/songs/:mbid/reviews` | No | Song reviews + stats |
| GET | `/api/reviews` | No | Recent reviews (home page) |
| POST | `/api/reviews` | Yes | `{ targetType: 'album'\|'song', mbid, text, rating }` |
| GET | `/api/reviews/:id` | No | One review |
| PATCH | `/api/reviews/:id` | Owner | `{ text, rating }` |
| DELETE | `/api/reviews/:id` | Owner | Deletes review, rating and its comments |
| GET | `/api/reviews/:id/comments` | No | Comments, oldest first |
| POST | `/api/reviews/:id/comments` | Yes | `{ text }` |
| PATCH | `/api/comments/:id` | Owner | `{ text }` |
| DELETE | `/api/comments/:id` | Owner | |
| GET | `/api/diary` | Yes | Your diary `{ entries, visibility }` |
| POST | `/api/diary` | Yes | `{ targetType, mbid, listenedOn: 'YYYY-MM-DD', notes? }` |
| PATCH | `/api/diary/:id` | Owner | `{ listenedOn, notes }` |
| DELETE | `/api/diary/:id` | Owner | |
| PUT | `/api/diary/settings` | Yes | `{ visibility: 'public'\|'private' }` |
| GET | `/api/users/:username/reviews` | No | A user's reviews |
| GET | `/api/users/:username/diary` | No* | `403` if private and you aren't the owner |

The author or owner always comes from `req.session.userId`; any user ID in the
request body is ignored. "Owner" routes return `403` for other users and `401`
when logged out.

Validation (backend, mirrored in the frontend): review text 1–5,000 characters,
comment 1–1,000, diary notes up to 1,000; whitespace-only text is rejected;
control characters are stripped. Text is stored as typed and rendered by React,
which escapes it, so `<script>` shows up as text (no XSS). All SQL uses `?` placeholders.

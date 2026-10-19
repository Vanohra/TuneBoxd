# TuneBoxd
https://tuneboxd.onrender.com/

A music review and personal listening site inspired by Letterboxd.

Currently built:

- **Sprint 2:** sign up, log in, log out, session persistence, protected routes,
  profiles (photo, display name, bio), public member profiles, and following other members.
- **Sprint 3:** music search and album/artist/song pages (MusicBrainz + Cover Art Archive),
  reviews with half-star ratings, comments on reviews, and a listening diary with
  public/private visibility.

All user data is stored in **MySQL on Amazon RDS** (database `music_review_app`,
schema in [database/schema.sql](database/schema.sql)). See
[docs/database-integration.md](docs/database-integration.md) for how the backend maps to the tables and
[docs/sprint3-music-features.md](docs/sprint3-music-features.md) for the Sprint 3 design
(MusicBrainz mapping, rate limiting, API).

## Tech stack

| Part     | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19 + Vite, React Router, plain CSS (`frontend/src/styles.css`) |
| Backend  | Node.js + Express 5, `express-session` (cookie sessions), `bcryptjs` |
| Database | MySQL 8 on Amazon RDS via `mysql2` (connection pool, prepared statements) |
| Music data | [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) (via the backend) + [Cover Art Archive](https://coverartarchive.org/) |

## Running locally

Requires Node.js 20.12+.

**Quick start from the repo root (one terminal):** after creating `.env` (step 0 below), run
`npm run setup` (installs backend + frontend dependencies), then `npm run dev` (starts both
servers; Ctrl+C stops them). Other root scripts: `npm run migrate`, `npm run build`,
`npm run preview`, `npm test`.

Or use two terminals:

**0. Database credentials.** Copy `.env.example` to `.env` in the repo root and fill in
the RDS values. `.env` is gitignored. Never commit it or put credentials in code.

**1. Backend** (http://localhost:4000)

```bash
cd backend
npm install
npm run migrate   # applies database/migrations/*.sql (safe to re-run)
npm run dev
```

**2. Frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

On startup the backend runs `SELECT 1` and prints either `Database connection successful.`
or `Unable to connect to database (<code>). <hint>` and exits. That tells you right away
whether RDS is reachable, before you start debugging login.

Open http://localhost:5173. The Vite dev server forwards `/api/*` to the backend,
so the browser sees one origin and the session cookie just works (no CORS setup).

### Environment variables (backend, read from the repo-root `.env`)

| Variable         | Default                     | Notes                                       |
| ---------------- | --------------------------- | ------------------------------------------- |
| `DB_HOST`        | none (required)             | RDS endpoint hostname                       |
| `DB_PORT`        | `3306`                      |                                             |
| `DB_USER`        | none (required)             |                                             |
| `DB_PASSWORD`    | none (required)             |                                             |
| `DB_NAME`        | `music_review_app`          |                                             |
| `SESSION_SECRET` | dev-only placeholder        | **Required** when `NODE_ENV=production`     |
| `PORT`           | `4000`                      |                                             |
| `NODE_ENV`       | unset                       | `production` turns on `Secure` cookies      |
| `MUSICBRAINZ_CONTACT` | project GitHub URL     | Email/URL in the MusicBrainz User-Agent     |
| `DB_SSL`         | unset                       | `true` = TLS to RDS (set on Render)         |

### Deploying

TuneBoxd deploys to Render as one web service (Express serves the API and the built
React app). See [docs/deployment-render.md](docs/deployment-render.md).

### Tests

```bash
cd backend
npm test
```

Runs unit tests (validation, MusicBrainz mapping) and end-to-end API tests against the
**real RDS database and live MusicBrainz** (about a minute, because of the 1 request/second
limit). The API tests create throwaway users named `s3test_*` and delete them at the end.

## API

| Method | Path                 | Auth? | Purpose                                         |
| ------ | -------------------- | ----- | ----------------------------------------------- |
| POST   | `/api/auth/register` | No    | `{ username, email, password, confirmPassword }` |
| POST   | `/api/auth/login`    | No    | `{ identifier, password }` (username or email)  |
| POST   | `/api/auth/logout`   | No    | Destroys the session and clears the cookie      |
| GET    | `/api/me`            | Yes   | Current user (`401` if not logged in)           |
| PATCH  | `/api/me`            | Yes   | Update `{ username, email, displayName?, bio?, avatarUrl? }` |
| GET    | `/api/users`         | No    | Member list (with `isFollowing` when logged in) |
| GET    | `/api/users/:username` | No  | Public profile + `stats` (reviews, followers, following) |
| GET    | `/api/users/:username/followers` | No | Users who follow them           |
| GET    | `/api/users/:username/following` | No | Users they follow               |
| POST   | `/api/users/:username/follow`    | Yes | Follow                          |
| DELETE | `/api/users/:username/follow`    | Yes | Unfollow                        |

Sprint 3 adds `/api/music/*`, `/api/reviews/*`, `/api/comments/*`, `/api/diary/*`,
`/api/users/:username/reviews` and `/api/users/:username/diary`. See the full table in
[docs/sprint3-music-features.md](docs/sprint3-music-features.md#api-added-in-sprint-3).

Errors look like `{ "error": "Message", "fieldErrors": { "email": "..." } }`.
Your own user object (`/api/me`) contains `id` (= `users.user_id`), `username`, `email`,
`displayName`, `bio`, `avatarUrl`, `role` and `createdAt`. Other people's profiles never include `email`.
Password hashes are never sent to the browser.

`avatarUrl` is currently a small base64 JPEG data URL. The frontend crops and resizes
uploads to 256×256 before sending, and the backend only accepts PNG/JPEG/WebP data
URLs up to ~256 KB.

## How sessions work

1. On login the server checks the bcrypt hash and `account_status`, regenerates the
   session (preventing session fixation), and stores only `req.session.userId` (= `users.user_id`).
2. The browser gets an `HttpOnly`, `SameSite=Lax` cookie named `tuneboxd.sid`
   (also `Secure` in production). JavaScript can't read it, and nothing about auth
   is put in `localStorage`.
3. On every page load the frontend calls `GET /api/me`. A valid cookie restores the
   logged-in state, so refreshing does not log you out.
4. `requireAuth` middleware guards `/api/me` and follow/unfollow. It re-reads the user from
   MySQL on every request, so a suspended account (`403`) or deleted account (`401`)
   loses access immediately.
   The frontend's `ProtectedRoute` also redirects logged-out visitors to `/login`.
5. Logout destroys the server-side session and clears the cookie, so the old cookie
   stops working.
6. Sessions are held in express-session's in-memory store, so restarting the backend
   logs everyone out (accounts are safe in MySQL). A persistent MySQL session store
   would need a `sessions` table that isn't in the team schema yet.

## Project structure

```
backend/src/
  server.js                 Startup: DB check, then listen
  app.js                    Express app, session middleware, routes, error handler
  config.js                 Loads .env; port, session, cookie and DB settings
  db.js                     MySQL connection pool + startup SELECT 1 check
  routes/                   authRoutes.js (/api/auth/*), userRoutes.js (/api/me), socialRoutes.js,
                            musicRoutes.js, reviewRoutes.js, commentRoutes.js, diaryRoutes.js
  controllers/              HTTP layer: reads req, calls services, sends JSON
  services/                 authService.js (register/login), userService.js (own profile),
                            socialService.js (public profiles, follows),
                            musicBrainzClient.js (rate limit + cache), musicService.js (search, details,
                            find-or-create local music rows), reviewService.js, commentService.js, diaryService.js
  middleware/requireAuth.js 401 unless the session holds a valid user
  repositories/
    userRepository.js       users table (all user SQL; maps user_id → id etc.)
    followRepository.js     follows table
    musicRepository.js      artists / albums / songs (idempotent upserts by MBID)
    reviewRepository.js     reviews + ratings
    commentRepository.js    comments
    diaryRepository.js      diary_entries + user_settings.diary_visibility
backend/scripts/migrate.js  applies database/migrations/*.sql
backend/test/               unit + end-to-end API tests (node --test)
database/migrations/        additive schema changes (001: diary_entries.updated_at)
database/verify_sprint3.sql read-only queries for checking saved data in MySQL Workbench
  utils/                    validation, safe-user serializer, ServiceError

frontend/src/
  api/                      fetch wrapper + auth, users, music, reviews, diary API calls
  context/AuthContext.jsx   current-user state, restored via GET /api/me
  components/               Sidebar, Navbar (top bar + music search), ProfileView (header + tabs), UserList,
                            FollowButton, Avatar, Logo, Icons, FormField, Alert, route guards,
                            CoverArt, StarRating (display + picker), ReviewCard, ReviewForm,
                            CommentSection, TargetActivity (album/song reviews + actions),
                            DiaryEntryForm, DiaryList, Status (loading/empty/error)
  pages/                    Home, SignUp, Login, Logout, Profile (/profile), UserProfile (/u/:username),
                            Community, EditProfile, NotFound, Search, AlbumPage, ArtistPage,
                            SongPage, ReviewPage (/reviews/:id), Diary (/diary)
  utils/validation.js       client-side checks (mirrors the backend rules)
  utils/format.js           dates, durations, ratings
```

## Manual test checklist

With both servers running, at http://localhost:5173:

1. **Register**: Sign Up with a new username/email and matching passwords. You land
   on Login with the username prefilled.
2. **Duplicate username**: sign up again with the same username (any letter case). You see "Username is already taken."
3. **Duplicate email**: sign up again with the same email. You see "An account with this email already exists."
4. **Mismatched passwords**: you see "Passwords do not match."
5. **Log in** as the new user (username or email). You land on Profile.
6. **Wrong password**: you see "Incorrect username/email or password." (the same message for unknown users).
7. **Refresh** on Profile. You stay logged in.
8. **Logged out → /profile**: you are redirected to Login.
9. **Logged in → /profile**: shows avatar, username, email and member-since date.
10. **Edit Profile**: change username/email and save. Profile and navbar update immediately.
11. **Duplicate on edit**: set username to another existing user's name. You see "Username is already taken."
12. **Logout** from the navbar. You land on Login with "You have been logged out."
13. **After logout**: visiting `/profile` or `/profile/edit` redirects to Login, and
    `GET /api/me` returns `401`.
14. **Hashed passwords**: in MySQL Workbench, `SELECT username, password_hash FROM users;`
    shows bcrypt hashes (`$2b$10$...`), never the password. No API response includes it.
15. **Display name / bio**: on Edit Profile, set a display name and bio, then save.
    (Photo upload currently shows "Profile picture uploads aren't available yet": see
    the `avatar_url` note in docs/database-integration.md.)
16. **Follow**: open Community (sidebar) and follow another member. Their profile shows the
    Followers count +1, and they appear in your profile's **Following** tab.
17. **Unfollow**: hover "Following" so it reads "Unfollow", then click it. Counts drop.
18. **Tabs**: Overview / Reviews / Diary / Lists / Following / Followers. Clicking a stat
    opens the matching tab, and `?tab=` in the URL is shareable.
19. **Logged out**: `/u/<someone>` is viewable, but clicking Follow sends you to Login.
20. **Restart**: stop and restart the backend. You're logged out (sessions are in memory),
    but your account, profile edits and follows are still there. Log in again.
21. **Suspended account**: in Workbench run
    `UPDATE users SET account_status = 'suspended' WHERE username = '<name>';`.
    Logging in as them shows "This account has been suspended.", and an existing session
    gets `403` and is ended. Set it back to `'active'` to restore access.

### Sprint 3 checklist

22. **Search**: type "in rainbows" in the top bar. Album results with covers appear; the
    Artists and Songs tabs work; a nonsense query shows "No results".
23. **Album page**: open In Rainbows. You see the cover, release date, genres and a 10-track tracklist.
    `/album/not-an-id` shows "Album not found".
24. **Review**: logged out, "Write a Review" sends you to Login and back. Logged in, pick
    a rating, write text and post. "Your review was saved." appears and the review shows
    under Reviews with the average rating. Empty text or no rating shows an error.
25. **Edit review**: "Edit Your Review" (or Edit on the card) lets you change it; the card shows "edited".
    Other users see no Edit/Delete on your review.
26. **Diary**: "Add to Diary" on an album, pick a date and add notes. It appears on **My Diary**,
    grouped by month. Add the same album on another date: both entries show.
    Edit an entry; delete one (asks to confirm first).
27. **Diary privacy**: set My Diary to Private. As another user (or logged out), the
    profile's Diary tab says "This diary is private".
28. **Comments**: as another user, open "Comment" under a review and post. Refresh: it's still
    there. Only the author sees Edit/Delete on it.
29. **MySQL**: run [database/verify_sprint3.sql](database/verify_sprint3.sql) in Workbench to see the rows.

Quick API check with curl (Git Bash):

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"identifier":"<your username>","password":"<your password>"}' http://localhost:4000/api/auth/login
curl -b cookies.txt http://localhost:4000/api/me
```

## Not built yet

Lists, review likes, reporting reviews from the UI and a moderator screen (the backend already
hides reviews whose report is `removed`), notifications, OAuth, email verification, password reset,
admin tools (the `role` column exists and is returned by `/api/me`, but no route checks it yet).

# TuneBoxd

A music review and personal listening site inspired by Letterboxd.

Currently built: sign up, log in, log out, session persistence, protected routes,
profiles (photo, display name, bio), public member profiles, and following other members.

Users and follows are stored in **MySQL on Amazon RDS** (database `music_review_app`,
schema in [database/schema.sql](database/schema.sql)). See
[docs/database-integration.md](docs/database-integration.md) for how the backend maps to the tables.

## Tech stack

| Part     | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19 + Vite, React Router, plain CSS (`frontend/src/styles.css`) |
| Backend  | Node.js + Express 5, `express-session` (cookie sessions), `bcryptjs` |
| Database | MySQL 8 on Amazon RDS via `mysql2` (connection pool, prepared statements) |

## Running locally

Requires Node.js 20.12+. Use two terminals.

**0. Database credentials.** Copy `.env.example` to `.env` in the repo root and fill in
the RDS values. `.env` is gitignored. Never commit it or put credentials in code.

**1. Backend** (http://localhost:4000)

```bash
cd backend
npm install
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
  server.js                 Express app, session middleware, error handler
  config.js                 Loads .env; port, session, cookie and DB settings
  db.js                     MySQL connection pool + startup SELECT 1 check
  routes/                   authRoutes.js (/api/auth/*), userRoutes.js (/api/me)
  controllers/              HTTP layer: reads req, calls services, sends JSON
  services/                 authService.js (register/login), userService.js (own profile),
                            socialService.js (public profiles, follows)
  middleware/requireAuth.js 401 unless the session holds a valid user
  repositories/
    userRepository.js       users table (all user SQL; maps user_id → id etc.)
    followRepository.js     follows table
  utils/                    validation, safe-user serializer, ServiceError

frontend/src/
  api/                      fetch wrapper + auth API calls
  context/AuthContext.jsx   current-user state, restored via GET /api/me
  components/               Sidebar, Navbar (top bar), ProfileView (header + tabs), UserList,
                            FollowButton, Avatar, Logo, Icons, FormField, Alert, route guards
  pages/                    Home, SignUp, Login, Logout, Profile (/profile), UserProfile (/u/:username),
                            Community, EditProfile, NotFound
  utils/validation.js       client-side checks (mirrors the backend rules)
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
18. **Tabs**: Overview / Reviews / Lists / Following / Followers. Clicking a stat
    opens the matching tab, and `?tab=` in the URL is shareable.
19. **Logged out**: `/u/<someone>` is viewable, but clicking Follow sends you to Login.
20. **Restart**: stop and restart the backend. You're logged out (sessions are in memory),
    but your account, profile edits and follows are still there. Log in again.
21. **Suspended account**: in Workbench run
    `UPDATE users SET account_status = 'suspended' WHERE username = '<name>';`.
    Logging in as them shows "This account has been suspended.", and an existing session
    gets `403` and is ended. Set it back to `'active'` to restore access.

Quick API check with curl (Git Bash):

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"identifier":"<your username>","password":"<your password>"}' http://localhost:4000/api/auth/login
curl -b cookies.txt http://localhost:4000/api/me
```

## Not in this sprint

Reviews and ratings (the Reviews stat is 0 and the Reviews/Lists tabs show
empty states), diary, lists, likes/comments, notifications, music search and APIs,
OAuth, email verification, password reset, admin tools (the `role` column exists and is
returned by `/api/me`, but no route checks it yet).

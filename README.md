# TuneBoxd

A music review and personal listening site inspired by Letterboxd.

Currently built: sign up, log in, log out, session persistence, protected routes,
profiles (photo, display name, bio), public member profiles, and following other members.

> ⚠️ **No database yet.** Users are kept in a **temporary in-memory store** on the
> backend. **Every registered user, profile change, follow and session is wiped
> when the backend restarts.** This is expected. Database integration is being built separately;
> see [docs/database-integration.md](docs/database-integration.md).

## Tech stack

| Part     | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19 + Vite, React Router, plain CSS (`frontend/src/styles.css`) |
| Backend  | Node.js + Express 5, `express-session` (cookie sessions), `bcryptjs` |
| Storage  | TEMPORARY in-memory array (`backend/src/repositories/mockUserStore.js`) |

## Running locally

Requires Node.js 20+. Use two terminals.

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

Open http://localhost:5173. The Vite dev server forwards `/api/*` to the backend,
so the browser sees one origin and the session cookie just works (no CORS setup).

### Demo accounts

The temporary store is seeded with five accounts and a few follows, so profiles
and follower lists aren't empty:

- `demo` (email `demo@tuneboxd.com`), plus `alexr`, `musicmatt`, `sarahv`, `john_doe`
- Password for all of them: `tuneboxd123`

Only the bcrypt hash is stored in code.

### Environment variables (backend)

| Variable         | Default                     | Notes                                       |
| ---------------- | --------------------------- | ------------------------------------------- |
| `PORT`           | `4000`                      |                                             |
| `SESSION_SECRET` | dev-only placeholder        | **Required** when `NODE_ENV=production`     |
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
Your own user object (`/api/me`) contains `id`, `username`, `email`, `displayName`,
`bio`, `avatarUrl` and `createdAt`. Other people's profiles never include `email`.
Password hashes are never sent to the browser.

`avatarUrl` is currently a small base64 JPEG data URL. The frontend crops and resizes
uploads to 256×256 before sending, and the backend only accepts PNG/JPEG/WebP data
URLs up to ~256 KB.

## How sessions work

1. On login the server regenerates the session (preventing session fixation) and
   stores only `req.session.userId`.
2. The browser gets an `HttpOnly`, `SameSite=Lax` cookie named `tuneboxd.sid`
   (also `Secure` in production). JavaScript can't read it, and nothing about auth
   is put in `localStorage`.
3. On every page load the frontend calls `GET /api/me`. A valid cookie restores the
   logged-in state, so refreshing does not log you out.
4. `requireAuth` middleware guards `/api/me`, so protected data needs a real session.
   The frontend's `ProtectedRoute` also redirects logged-out visitors to `/login`.
5. Logout destroys the server-side session and clears the cookie, so the old cookie
   stops working.

## Project structure

```
backend/src/
  server.js                 Express app, session middleware, error handler
  config.js                 Port, session secret, cookie settings
  routes/                   authRoutes.js (/api/auth/*), userRoutes.js (/api/me)
  controllers/              HTTP layer: reads req, calls services, sends JSON
  services/                 authService.js (register/login), userService.js (own profile),
                            socialService.js (public profiles, follows)
  middleware/requireAuth.js 401 unless the session holds a valid user
  repositories/
    userRepository.js       ← user data access (swap in DB calls here)
    followRepository.js     ← follow data access (swap in DB calls here)
    mockUserStore.js        ← TEMPORARY in-memory arrays (delete once DB is ready)
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
2. **Duplicate username**: sign up again with `demo` as the username. You see "Username is already taken."
3. **Duplicate email**: sign up with `demo@tuneboxd.com`. You see "An account with this email already exists."
4. **Mismatched passwords**: you see "Passwords do not match."
5. **Log in** as the new user (username or email). You land on Profile.
6. **Wrong password**: you see "Incorrect username/email or password." (the same message for unknown users).
7. **Refresh** on Profile. You stay logged in.
8. **Logged out → /profile**: you are redirected to Login.
9. **Logged in → /profile**: shows avatar, username, email and member-since date.
10. **Edit Profile**: change username/email and save. Profile and navbar update immediately.
11. **Duplicate on edit**: set username to `demo`. You see "Username is already taken."
12. **Logout** from the navbar. You land on Login with "You have been logged out."
13. **After logout**: visiting `/profile` or `/profile/edit` redirects to Login, and
    `GET /api/me` returns `401`.
14. **Hashed passwords**: the store only holds bcrypt hashes (`$2b$10$...`). You can
    confirm with curl that no response ever includes `passwordHash`.
15. **Profile picture / bio**: on Edit Profile, upload a photo, set a display name and
    bio, then save. The profile header and top-bar avatar update. "Remove" clears the photo.
16. **Follow**: open Community (sidebar) and follow `sarahv`. Her profile shows the
    Followers count +1, and she appears in your profile's **Following** tab.
17. **Unfollow**: hover "Following" so it reads "Unfollow", then click it. Counts drop.
18. **Tabs**: Overview / Reviews / Lists / Following / Followers. Clicking a stat
    opens the matching tab, and `?tab=` in the URL is shareable.
19. **Logged out**: `/u/alexr` is viewable, but clicking Follow sends you to Login.
20. **Restart**: stop and restart the backend. Users you registered can no longer log
    in (only the seeded demo accounts remain), profile edits and follows reset, and existing sessions are gone.

Quick API check with curl (Git Bash):

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"identifier":"demo","password":"tuneboxd123"}' http://localhost:4000/api/auth/login
curl -b cookies.txt http://localhost:4000/api/me
```

## Not in this sprint

Database, reviews and ratings (the Reviews stat is 0 and the Reviews/Lists tabs show
empty states), diary, lists, likes/comments, notifications, music search and APIs,
OAuth, email verification, password reset, admin/roles.

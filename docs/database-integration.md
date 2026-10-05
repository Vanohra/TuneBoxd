# Database integration (users, auth, follows)

The backend talks to MySQL on Amazon RDS (`music_review_app`). The schema in
[`database/schema.sql`](../database/schema.sql) is the source of truth. The app
never creates, alters or drops tables.

## Layering

```
React UI (frontend/)
   ↓ fetch /api/*  (Vite proxy → :4000, session cookie)
routes → controllers
   ↓
services (authService, userService, socialService)   validation, bcrypt, rules
   ↓
repositories/userRepository.js     ← all SQL for `users`
repositories/followRepository.js   ← all SQL for `follows`
   ↓
src/db.js                          ← mysql2 connection pool (reads DB_* from .env)
   ↓
Amazon RDS → music_review_app
```

Only repository files import `db.js`. New features (reviews, ratings, lists, ...)
should follow the same pattern: add a `xxxRepository.js` with the SQL, call it
from a service, and protect write routes with `requireAuth`.

## Column mapping (users)

`userRepository.js` is the one place that converts between table columns and
the camelCase record the rest of the app uses:

| `users` column   | App field       | Notes                                               |
| ---------------- | --------------- | --------------------------------------------------- |
| `user_id`        | `id`            | Stored in `req.session.userId`                      |
| `username`       | `username`      | Case-insensitive unique (utf8mb4_unicode_ci)        |
| `email`          | `email`         | Lowercased before insert; case-insensitive unique   |
| `password_hash`  | `passwordHash`  | bcrypt (`$2b$10$...`). Never leaves the backend     |
| `display_name`   | `displayName`   | NULL ↔ `''`                                         |
| `bio`            | `bio`           | NULL ↔ `''`                                         |
| `avatar_url`     | `avatarUrl`     | see the note below                                  |
| `role`           | `role`          | Never set by the app; signup gets the default `user` |
| `account_status` | `accountStatus` | `suspended` blocks login and ends existing sessions |
| `created_at`     | `createdAt`     |                                                     |

`utils/safeUser.js` decides what goes to the browser: `toSafeUser` (yourself:
adds `email`, `role`) and `toPublicUser` (others). Neither includes the hash.

## Rules the code relies on

- Every query uses `?` placeholders via `pool.execute` (prepared statements).
- `INSERT INTO users` only sets `username, email, password_hash`; `role` and
  `account_status` come from the schema defaults, so a client can't make itself admin.
- MySQL's `ER_DUP_ENTRY` on `username`/`email` becomes a friendly 409.
- Connection-type errors (RDS unreachable, bad credentials) become a 503
  "can't reach its database" response. Other SQL errors become a generic 500. Logs
  contain only the MySQL error code and message, never SQL text, values or credentials.

## Schema note: `users.avatar_url` is VARCHAR(500)

The Edit Profile page sends the profile picture as a base64 data URL (a resized
256×256 JPEG, roughly 15–40 KB). That cannot fit in 500 characters, so
`utils/validation.js` currently rejects uploads with "Profile picture uploads
aren't available yet." Display name, bio and everything else work normally.

Two ways to fix it (team decision, not done automatically):

1. **Minimal schema change** (simplest for now):
   ```sql
   ALTER TABLE users MODIFY avatar_url MEDIUMTEXT NULL;
   ```
   then set `AVATAR_MAX_LENGTH` in `backend/src/utils/validation.js` back to `350_000`.
2. **Keep the schema** and upload images to object storage (e.g. S3), storing
   only the resulting URL (fits in 500 chars) in `avatar_url`.

## Sessions

Sessions use express-session's in-memory store: only `userId` is stored,
restarting the backend logs everyone out, and accounts are unaffected. A
persistent MySQL session store (e.g. `express-mysql-session`) would need its own
`sessions` table, which isn't in the team schema yet.

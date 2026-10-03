# Database integration handoff (users, profiles, follows)

Auth, sessions, profiles and follows currently run on **TEMPORARY in-memory
storage**. This note is for whoever connects the real database. No schema,
migrations, ORM models or DB dependencies were added, and the table design is
entirely yours.

## Layering

```
React UI (frontend/)                         unchanged by DB work
   ↓ fetch /api/*
routes → controllers                         unchanged
   ↓
services (authService, userService,          unchanged: validation, hashing,
          socialService)                     duplicate checks, follow rules
   ↓
repositories/userRepository.js               ← REPLACE the function bodies here
repositories/followRepository.js             ← and here
   ↓
repositories/mockUserStore.js                ← TEMPORARY: delete when done
```

Only the two repository files import `mockUserStore.js`.

## Users: `backend/src/repositories/userRepository.js`

Each function has a `TODO: Replace temporary user store with ...` comment.

| Function                                        | Must return / do                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `findUserById(id)`                              | user record or `null`                                              |
| `findUserByUsername(username)`                  | user record or `null`, **case-insensitive**                        |
| `findUserByEmail(email)`                        | user record or `null`, **case-insensitive**                        |
| `findUsersByIds(ids)`                           | array of user records (any order, skip missing IDs)                |
| `listUsers()`                                   | array of all users, newest first (add paging later)                |
| `createUser({ username, email, passwordHash })` | insert; return the created record (DB generates `id`, `createdAt`) |
| `updateUser(id, changes)`                       | update only the keys present in `changes` (`username`, `email`, `displayName`, `bio`, `avatarUrl`); return the updated record, or `null` if no such user |

**Record shape the app expects** (map your column names to this inside the repository):

```js
{ id, username, email, passwordHash, displayName, bio, avatarUrl, createdAt }
```

- `id` is stored in the session (`req.session.userId`) and compared with `===`, so
  keep it the same type every time (number or string, just consistently).
- `createdAt` should be an ISO string or a `Date` (the frontend shows "Member since ...").
- `passwordHash` is a bcrypt string (≤ 60 chars, e.g. `$2b$10$...`). Store it as-is.
- `displayName` (≤ 50 chars) and `bio` (≤ 160 chars) are strings; return `''` when empty.
- `avatarUrl` is `null` or a string. **Right now it holds a small base64 data URL**
  (a 256×256 JPEG, roughly 15–40 KB) because there is no file storage yet. You can
  store it as text, or move images to file/object storage and keep only a URL in
  the database. The frontend just puts whatever string it gets into `<img src>`.
- Keep every function `async`.

**Uniqueness:** services already check for duplicates before writing. A unique
constraint on username and email (case-insensitive) is still recommended. When the
DB rejects a duplicate, throw `new DuplicateUserError('username')` or
`new DuplicateUserError('email')` (exported from the repository), and the services
turn it into the friendly 409 message.

Emails are already lowercased before they reach the repository. Usernames keep the
case the user typed, so username lookups need to be case-insensitive.

## Follows: `backend/src/repositories/followRepository.js`

A follow means "`followerId` follows `followingId`". Everything uses user IDs.

| Function                                    | Must return / do                                         |
| ------------------------------------------- | -------------------------------------------------------- |
| `isFollowing(followerId, followingId)`      | boolean                                                  |
| `addFollow(followerId, followingId)`        | insert; **no-op if it already exists**                   |
| `removeFollow(followerId, followingId)`     | delete; no-op if it doesn't exist                        |
| `countFollowers(userId)` / `countFollowing(userId)` | numbers                                          |
| `listFollowerIds(userId)` / `listFollowingIds(userId)` | arrays of user IDs, most recent first         |
| `filterFollowedIds(followerId, candidateIds)` | the subset of `candidateIds` that `followerId` follows |

The service layer already blocks following yourself and checks that both users
exist. A unique (follower, following) pair is recommended in the database.

## Other places that mention temporary storage

- `backend/src/repositories/mockUserStore.js`: delete once both repositories use the DB.
  It seeds five demo accounts (`demo`, `alexr`, `musicmatt`, `sarahv`, `john_doe`)
  and a few follows. Recreate them in your seed data if you want to keep them.
- `backend/src/services/socialService.js`: `stats.reviews` is hard-coded to `0`
  (`TODO`) until reviews exist.
- `backend/src/server.js`: sessions use express-session's default **MemoryStore**
  (also cleared on restart). Optionally, plug in a persistent session store via the
  `store` option once the DB exists. No code elsewhere would change.

## Things you do NOT need to touch

Password hashing (`authService.js`), validation (`utils/validation.js`), session
creation/destruction (`authController.js`), the `requireAuth` middleware, the
follow rules in `socialService.js`, and the whole frontend.

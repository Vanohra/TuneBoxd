// TEMPORARY: In-memory user + follow store. Replace with the real database when
// database integration is ready (see docs/database-integration.md).
//
// - Everything here lives in this Node process's memory, so ALL users and follows
//   (including anything created at runtime) are lost whenever the backend restarts.
// - Only the repository files may import this file. Services, controllers and
//   routes must go through the repositories so this file can be deleted later.
// - Passwords are never stored in plaintext, only bcrypt hashes.

// bcrypt hash of the shared demo password listed in README.md ("Demo accounts").
const DEMO_PASSWORD_HASH = '$2b$10$HGPIAnR40AwDtcfqeUr3EuqymxUldvSXF8.0rzm5XYe6ID3XFiWbu';

export const mockUsers = [
  {
    id: 1,
    username: 'demo',
    email: 'demo@tuneboxd.com',
    passwordHash: DEMO_PASSWORD_HASH,
    displayName: 'Demo User',
    bio: 'Just here to test TuneBoxd.',
    avatarUrl: null,
    createdAt: '2026-01-15T12:00:00.000Z',
  },
  {
    id: 2,
    username: 'alexr',
    email: 'alex@example.com',
    passwordHash: DEMO_PASSWORD_HASH,
    displayName: 'Alex Rivera',
    bio: 'Music lover. Always discovering something new.',
    avatarUrl: null,
    createdAt: '2026-02-03T12:00:00.000Z',
  },
  {
    id: 3,
    username: 'musicmatt',
    email: 'matt@example.com',
    passwordHash: DEMO_PASSWORD_HASH,
    displayName: 'Matt',
    bio: 'Vinyl collector. Hip-hop and jazz, mostly.',
    avatarUrl: null,
    createdAt: '2026-03-21T12:00:00.000Z',
  },
  {
    id: 4,
    username: 'sarahv',
    email: 'sarah@example.com',
    passwordHash: DEMO_PASSWORD_HASH,
    displayName: 'Sarah V.',
    bio: 'Indie pop forever.',
    avatarUrl: null,
    createdAt: '2026-05-09T12:00:00.000Z',
  },
  {
    id: 5,
    username: 'john_doe',
    email: 'john@example.com',
    passwordHash: DEMO_PASSWORD_HASH,
    displayName: '',
    bio: '',
    avatarUrl: null,
    createdAt: '2026-07-30T12:00:00.000Z',
  },
];

// Each entry means "followerId follows followingId".
export const mockFollows = [
  { followerId: 2, followingId: 1, createdAt: '2026-02-04T12:00:00.000Z' },
  { followerId: 3, followingId: 1, createdAt: '2026-03-22T12:00:00.000Z' },
  { followerId: 1, followingId: 2, createdAt: '2026-02-05T12:00:00.000Z' },
  { followerId: 3, followingId: 2, createdAt: '2026-03-22T12:00:00.000Z' },
  { followerId: 4, followingId: 2, createdAt: '2026-05-10T12:00:00.000Z' },
  { followerId: 2, followingId: 4, createdAt: '2026-05-11T12:00:00.000Z' },
];

let lastId = mockUsers.length;

// TEMPORARY: The database will generate IDs itself once integrated.
export function generateUserId() {
  lastId += 1;
  return lastId;
}

/**
 * User repository: the ONLY module the rest of the backend uses to read or
 * write user records.
 *
 * Right now every function is backed by the TEMPORARY in-memory store in
 * mockUserStore.js. When the database is ready, the database teammate only needs
 * to rewrite the bodies of these functions. Services, controllers, routes and
 * the frontend should not need to change.
 *
 * Contract the rest of the app relies on:
 *   - Every function is async (returns a Promise), just like a real DB call.
 *   - User records are returned as plain objects with at least:
 *       { id, username, email, passwordHash, displayName, bio, avatarUrl, createdAt }
 *     displayName and bio are strings ('' when empty); avatarUrl is a string or null.
 *     If the real table uses different column names, map them to this shape
 *     here so nothing upstream changes.
 *   - Lookups by username/email are case-insensitive.
 *   - Lookups return null when nothing matches.
 *   - createUser/updateUser throw DuplicateUserError when a username or email is
 *     already taken (a real DB would signal this with a unique-constraint error).
 */
import { mockUsers, generateUserId } from './mockUserStore.js';

export class DuplicateUserError extends Error {
  constructor(field) {
    super(`Duplicate ${field}`);
    this.name = 'DuplicateUserError';
    this.field = field; // 'username' | 'email'
  }
}

const normalize = (value) => String(value).trim().toLowerCase();

// Return copies so callers can't mutate the store by accident.
const copy = (user) => (user ? { ...user } : null);

// TEMPORARY: helper for the mock store only. A database enforces this with unique constraints.
function assertUnique({ username, email }, ignoreId = null) {
  for (const user of mockUsers) {
    if (user.id === ignoreId) continue;
    if (username !== undefined && normalize(user.username) === normalize(username)) {
      throw new DuplicateUserError('username');
    }
    if (email !== undefined && normalize(user.email) === normalize(email)) {
      throw new DuplicateUserError('email');
    }
  }
}

export async function findUserById(id) {
  // TODO: Replace temporary user store with database lookup by user ID.
  return copy(mockUsers.find((user) => user.id === id));
}

export async function findUserByUsername(username) {
  // TODO: Replace temporary user store with case-insensitive database lookup by username.
  return copy(mockUsers.find((user) => normalize(user.username) === normalize(username)));
}

export async function findUserByEmail(email) {
  // TODO: Replace temporary user store with case-insensitive database lookup by email.
  return copy(mockUsers.find((user) => normalize(user.email) === normalize(email)));
}

/**
 * @param {{ username: string, email: string, passwordHash: string }} data
 * @returns the created user record
 */
export async function createUser({ username, email, passwordHash }) {
  // TODO: Replace temporary user store with database insert.
  // The database should generate `id` and `createdAt`, and translate a
  // unique-constraint violation into `new DuplicateUserError('username' | 'email')`.
  assertUnique({ username, email });
  const user = {
    id: generateUserId(),
    username,
    email,
    passwordHash,
    displayName: '',
    bio: '',
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  };
  mockUsers.push(user);
  return copy(user);
}

const UPDATABLE_FIELDS = ['username', 'email', 'displayName', 'bio', 'avatarUrl'];

/**
 * @param {number} id
 * @param {{ username?, email?, displayName?, bio?, avatarUrl? }} changes
 *   Fields that are undefined are left unchanged.
 * @returns the updated user record, or null if no user has that ID
 */
export async function updateUser(id, changes) {
  // TODO: Replace temporary user store with database update.
  // Translate unique-constraint violations into DuplicateUserError as in createUser.
  const user = mockUsers.find((candidate) => candidate.id === id);
  if (!user) return null;
  assertUnique(changes, id);
  for (const field of UPDATABLE_FIELDS) {
    if (changes[field] !== undefined) user[field] = changes[field];
  }
  return copy(user);
}

/** @returns users with the given IDs (order not guaranteed; missing IDs skipped) */
export async function findUsersByIds(ids) {
  // TODO: Replace temporary user store with a database lookup of several users by ID.
  const wanted = new Set(ids);
  return mockUsers.filter((user) => wanted.has(user.id)).map(copy);
}

/** @returns all users, newest first */
export async function listUsers() {
  // TODO: Replace temporary user store with a database query (add paging once there are many users).
  return mockUsers.map(copy).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

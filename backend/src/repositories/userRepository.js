/**
 * User repository: the ONLY module the rest of the backend uses to read or
 * write the `users` table.
 *
 * This is also the adapter between the database and the app. Rows use the
 * schema's snake_case columns (user_id, password_hash, ...); the rest of the
 * backend and the frontend use this camelCase record shape:
 *   { id, username, email, passwordHash, displayName, bio, avatarUrl,
 *     role, accountStatus, createdAt }
 * `id` is always users.user_id (a number).
 *
 * All SQL uses `?` placeholders (prepared statements), never string concatenation.
 * Lookups by username/email are case-insensitive because the columns use the
 * case-insensitive utf8mb4_unicode_ci collation.
 */
import { pool } from '../db.js';

export class DuplicateUserError extends Error {
  constructor(field) {
    super(`Duplicate ${field}`);
    this.name = 'DuplicateUserError';
    this.field = field; // 'username' | 'email'
  }
}

const USER_COLUMNS = `user_id, username, email, password_hash, display_name, bio, avatar_url,
  role, account_status, created_at`;

function toUser(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? null,
    role: row.role,
    accountStatus: row.account_status,
    createdAt: row.created_at,
  };
}

/** Turns MySQL's duplicate-key error (UNIQUE username/email) into DuplicateUserError. */
function rethrowDuplicate(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    // sqlMessage looks like: Duplicate entry 'x' for key 'users.email'
    const key = /for key '(?:[\w]+\.)?(\w+)'/.exec(err.sqlMessage || '')?.[1];
    if (key === 'username' || key === 'email') throw new DuplicateUserError(key);
  }
  throw err;
}

async function findOne(whereClause, value) {
  const [rows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE ${whereClause} LIMIT 1`, [value]);
  return toUser(rows[0]);
}

export async function findUserById(id) {
  return findOne('user_id = ?', id);
}

export async function findUserByUsername(username) {
  return findOne('username = ?', String(username).trim());
}

export async function findUserByEmail(email) {
  return findOne('email = ?', String(email).trim().toLowerCase());
}

/**
 * Inserts a new user. role and account_status are intentionally NOT set here,
 * so every signup gets the schema defaults ('user', 'active').
 * @param {{ username: string, email: string, passwordHash: string }} data
 * @returns the created user record
 */
export async function createUser({ username, email, passwordHash }) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash],
    );
    return findUserById(result.insertId);
  } catch (err) {
    rethrowDuplicate(err);
  }
}

// App field → column. Only these can be changed through updateUser (never role,
// account_status or password_hash). Column names come from this fixed map, never
// from user input; values are always bound with placeholders.
const UPDATABLE_COLUMNS = {
  username: 'username',
  email: 'email',
  displayName: 'display_name',
  bio: 'bio',
  avatarUrl: 'avatar_url',
};

/**
 * @param {number} id
 * @param {{ username?, email?, displayName?, bio?, avatarUrl? }} changes
 *   Fields that are undefined are left unchanged.
 * @returns the updated user record, or null if no user has that ID
 */
export async function updateUser(id, changes) {
  const assignments = [];
  const values = [];
  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (changes[field] === undefined) continue;
    assignments.push(`${column} = ?`);
    // Store empty display name / bio as NULL, matching new signups.
    values.push(changes[field] === '' ? null : changes[field]);
  }

  if (assignments.length > 0) {
    try {
      await pool.execute(`UPDATE users SET ${assignments.join(', ')} WHERE user_id = ?`, [...values, id]);
    } catch (err) {
      rethrowDuplicate(err);
    }
  }
  return findUserById(id);
}

/** @returns users with the given IDs (order not guaranteed; missing IDs skipped) */
export async function findUsersByIds(ids) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE user_id IN (${placeholders})`, ids);
  return rows.map(toUser);
}

/** @returns all active users, newest first */
export async function listUsers() {
  // TODO: Add paging once there are many users.
  const [rows] = await pool.execute(
    `SELECT ${USER_COLUMNS} FROM users WHERE account_status = 'active' ORDER BY created_at DESC, user_id DESC`,
  );
  return rows.map(toUser);
}

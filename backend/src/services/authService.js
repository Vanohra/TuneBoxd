/**
 * Authentication business logic: registration and credential checks.
 * Talks to storage only through userRepository, so it does not care whether
 * users live in the temporary mock store or the real database.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as userRepository from '../repositories/userRepository.js';
import { DuplicateUserError } from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { toSafeUser } from '../utils/safeUser.js';
import { validateLogin, validateRegistration } from '../utils/validation.js';

const BCRYPT_SALT_ROUNDS = 10;

export const DUPLICATE_MESSAGES = {
  username: 'Username is already taken.',
  email: 'An account with this email already exists.',
};
const INVALID_CREDENTIALS = 'Incorrect username/email or password.';
const ACCOUNT_SUSPENDED = 'This account has been suspended.';

/** Throws 403 unless users.account_status is 'active'. */
export function assertAccountActive(user) {
  if (user.accountStatus !== 'active') throw new ServiceError(403, ACCOUNT_SUSPENDED);
}

// Compared against when no user matches, so a login attempt takes about the same
// time whether or not the account exists (this avoids leaking which accounts exist).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_SALT_ROUNDS);

/** Throws a 409 ServiceError listing every taken field (username and/or email). */
export function throwDuplicateError(fields) {
  const fieldErrors = Object.fromEntries(fields.map((field) => [field, DUPLICATE_MESSAGES[field]]));
  throw new ServiceError(409, DUPLICATE_MESSAGES[fields[0]], fieldErrors);
}

/** Validates input, checks for duplicates, hashes the password and stores the user. */
export async function registerUser(input) {
  const { values, fieldErrors, error } = validateRegistration(input);
  if (error) throw new ServiceError(400, error, fieldErrors);

  const taken = [];
  if (await userRepository.findUserByUsername(values.username)) taken.push('username');
  if (await userRepository.findUserByEmail(values.email)) taken.push('email');
  if (taken.length > 0) throwDuplicateError(taken);

  const passwordHash = await bcrypt.hash(values.password, BCRYPT_SALT_ROUNDS);

  try {
    // Only these three fields are passed on. Anything else in the request body
    // (e.g. role: 'admin') is ignored; role/account_status use the schema defaults.
    const user = await userRepository.createUser({
      username: values.username,
      email: values.email,
      passwordHash,
    });
    return toSafeUser(user);
  } catch (err) {
    // Another request may have claimed the name between our check and the insert.
    if (err instanceof DuplicateUserError) throwDuplicateError([err.field]);
    throw err;
  }
}

/**
 * Checks a username-or-email + password pair.
 * @returns the safe user on success. Throws a generic 401 otherwise.
 */
export async function authenticate(input) {
  const { values, error } = validateLogin(input);
  if (error) throw new ServiceError(400, error);

  const { identifier, password } = values;
  // Usernames cannot contain "@", so an "@" means the user typed an email.
  const user = identifier.includes('@')
    ? await userRepository.findUserByEmail(identifier)
    : await userRepository.findUserByUsername(identifier);

  const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordMatches) {
    // Same message whether the account is missing or the password is wrong.
    throw new ServiceError(401, INVALID_CREDENTIALS);
  }
  // Checked only after the password matched, so this can't be used to probe
  // which accounts exist or are suspended.
  assertAccountActive(user);
  return toSafeUser(user);
}

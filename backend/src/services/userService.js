/**
 * Profile business logic for the signed-in user.
 * Like authService, this only talks to storage through userRepository.
 */
import * as userRepository from '../repositories/userRepository.js';
import { DuplicateUserError } from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { toSafeUser } from '../utils/safeUser.js';
import { validateProfileUpdate } from '../utils/validation.js';
import { throwDuplicateError } from './authService.js';

/** @returns the safe user for this ID, or null if it no longer exists. */
export async function getUserById(userId) {
  return toSafeUser(await userRepository.findUserById(userId));
}

/** Validates and applies username/email/display name/bio/avatar changes for the given user. */
export async function updateProfile(userId, input) {
  const { values, fieldErrors, error } = validateProfileUpdate(input);
  if (error) throw new ServiceError(400, error, fieldErrors);

  // Uniqueness checks ignore the user's own current values.
  const taken = [];
  const usernameOwner = await userRepository.findUserByUsername(values.username);
  if (usernameOwner && usernameOwner.id !== userId) taken.push('username');
  const emailOwner = await userRepository.findUserByEmail(values.email);
  if (emailOwner && emailOwner.id !== userId) taken.push('email');
  if (taken.length > 0) throwDuplicateError(taken);

  try {
    const updated = await userRepository.updateUser(userId, values);
    if (!updated) throw new ServiceError(401, 'Your session has expired. Please log in again.');
    return toSafeUser(updated);
  } catch (err) {
    if (err instanceof DuplicateUserError) throwDuplicateError([err.field]);
    throw err;
  }
}

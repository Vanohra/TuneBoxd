import { apiRequest } from './client.js';

export function registerUser({ username, email, password, confirmPassword }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { username, email, password, confirmPassword },
  });
}

export async function loginUser({ identifier, password }) {
  const { user } = await apiRequest('/auth/login', { method: 'POST', body: { identifier, password } });
  return user;
}

export function logoutUser() {
  return apiRequest('/auth/logout', { method: 'POST' });
}

/** Returns the signed-in user, or throws ApiError with status 401 if there's no session. */
export async function fetchCurrentUser() {
  const { user } = await apiRequest('/me');
  return user;
}

/** `avatarUrl` is optional: omit to keep, null to remove, data URL to replace. */
export async function updateProfile({ username, email, displayName, bio, avatarUrl }) {
  const { user } = await apiRequest('/me', {
    method: 'PATCH',
    body: { username, email, displayName, bio, avatarUrl },
  });
  return user;
}

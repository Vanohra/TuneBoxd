import { apiRequest } from './client.js';

const path = (username, suffix = '') => `/users/${encodeURIComponent(username)}${suffix}`;

/** Public profile with stats and the viewer's follow state. */
export async function fetchProfile(username) {
  const { profile } = await apiRequest(path(username));
  return profile;
}

export async function fetchFollowers(username) {
  const { users } = await apiRequest(path(username, '/followers'));
  return users;
}

export async function fetchFollowing(username) {
  const { users } = await apiRequest(path(username, '/following'));
  return users;
}

export async function fetchMembers() {
  const { users } = await apiRequest('/users');
  return users;
}

/** Returns the target's updated profile. */
export async function followUser(username) {
  const { profile } = await apiRequest(path(username, '/follow'), { method: 'POST' });
  return profile;
}

export async function unfollowUser(username) {
  const { profile } = await apiRequest(path(username, '/follow'), { method: 'DELETE' });
  return profile;
}

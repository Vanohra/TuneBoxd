/**
 * Public profiles and follow relationships.
 * Talks to storage only through userRepository and followRepository.
 *
 * `viewerId` is the signed-in user's ID, or null for logged-out visitors. It
 * decides `isFollowing` / `isOwnProfile` flags and never grants extra data.
 */
import * as followRepository from '../repositories/followRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { toPublicUser } from '../utils/safeUser.js';

async function requireUserByUsername(username) {
  const user = await userRepository.findUserByUsername(String(username ?? ''));
  if (!user) throw new ServiceError(404, 'User not found.');
  return user;
}

/** Public user cards for a list of IDs, keeping the given order, each with `isFollowing`. */
async function toUserCards(ids, viewerId) {
  const users = await userRepository.findUsersByIds(ids);
  const byId = new Map(users.map((user) => [user.id, user]));
  const followed = new Set(viewerId ? await followRepository.filterFollowedIds(viewerId, ids) : []);
  return ids
    .filter((id) => byId.has(id))
    .map((id) => ({ ...toPublicUser(byId.get(id)), isFollowing: followed.has(id) }));
}

export async function getProfile(username, viewerId) {
  const user = await requireUserByUsername(username);
  const [followers, following, isFollowing] = await Promise.all([
    followRepository.countFollowers(user.id),
    followRepository.countFollowing(user.id),
    viewerId ? followRepository.isFollowing(viewerId, user.id) : false,
  ]);
  return {
    ...toPublicUser(user),
    stats: {
      // TODO: Replace with the user's real review count once reviews exist.
      reviews: 0,
      followers,
      following,
    },
    isFollowing,
    isOwnProfile: viewerId === user.id,
  };
}

export async function listFollowers(username, viewerId) {
  const user = await requireUserByUsername(username);
  return toUserCards(await followRepository.listFollowerIds(user.id), viewerId);
}

export async function listFollowing(username, viewerId) {
  const user = await requireUserByUsername(username);
  return toUserCards(await followRepository.listFollowingIds(user.id), viewerId);
}

/** Every member except the viewer (for the Community page). */
export async function listMembers(viewerId) {
  const users = await userRepository.listUsers();
  const ids = users.map((user) => user.id).filter((id) => id !== viewerId);
  return toUserCards(ids, viewerId);
}

export async function follow(viewerId, username) {
  const target = await requireUserByUsername(username);
  if (target.id === viewerId) throw new ServiceError(400, 'You can’t follow yourself.');
  await followRepository.addFollow(viewerId, target.id);
  return getProfile(target.username, viewerId);
}

export async function unfollow(viewerId, username) {
  const target = await requireUserByUsername(username);
  await followRepository.removeFollow(viewerId, target.id);
  return getProfile(target.username, viewerId);
}

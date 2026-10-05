/**
 * Picks only the fields that are safe to send to the signed-in user about
 * themselves. Always pass user records through this before responding.
 * Never send passwordHash. `role` is informational for the UI only; the server
 * always re-reads it from the database before authorizing anything.
 */
export function toSafeUser(user) {
  if (!user) return null;
  return {
    ...toPublicUser(user),
    email: user.email,
    role: user.role,
  };
}

/** Fields anyone may see about another user. No email, no password hash. */
export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || '',
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || null,
    createdAt: user.createdAt,
  };
}

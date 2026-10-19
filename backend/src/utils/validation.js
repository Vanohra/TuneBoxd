// Server-side input validation. The frontend runs the same rules for fast
// feedback (frontend/src/utils/validation.js), but the backend never trusts it.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,30}$/;
export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes
const EMAIL_MAX_LENGTH = 255; // users.email is VARCHAR(255)

const MESSAGES = {
  required: 'All fields are required.',
  usernameBlank: 'Username cannot be blank.',
  usernameFormat: 'Username must be 3–30 characters: letters, numbers, underscores or periods.',
  emailBlank: 'Email cannot be blank.',
  emailFormat: 'Please enter a valid email.',
  emailLength: `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`,
  passwordBlank: 'Password cannot be blank.',
  passwordLength: `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`,
  passwordMismatch: 'Passwords do not match.',
};

const asString = (value) => (typeof value === 'string' ? value : '');

function checkUsername(username, fieldErrors) {
  if (!username) fieldErrors.username = MESSAGES.usernameBlank;
  else if (!USERNAME_PATTERN.test(username)) fieldErrors.username = MESSAGES.usernameFormat;
}

function checkEmail(email, fieldErrors) {
  if (!email) fieldErrors.email = MESSAGES.emailBlank;
  else if (email.length > EMAIL_MAX_LENGTH) fieldErrors.email = MESSAGES.emailLength;
  else if (!EMAIL_PATTERN.test(email)) fieldErrors.email = MESSAGES.emailFormat;
}

// "All fields are required." is shown when anything is blank. Otherwise the
// first field-specific message becomes the summary.
function summarize(fieldErrors, anyBlank) {
  const messages = Object.values(fieldErrors);
  if (messages.length === 0) return null;
  return anyBlank ? MESSAGES.required : messages[0];
}

/**
 * Validates and normalizes registration input.
 * @returns {{ values: object, fieldErrors: object, error: string|null }}
 */
export function validateRegistration(input = {}) {
  const username = asString(input.username).trim();
  const email = asString(input.email).trim().toLowerCase();
  const password = asString(input.password);
  const confirmPassword = input.confirmPassword === undefined ? undefined : asString(input.confirmPassword);

  const fieldErrors = {};
  checkUsername(username, fieldErrors);
  checkEmail(email, fieldErrors);
  if (!password) fieldErrors.password = MESSAGES.passwordBlank;
  else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = MESSAGES.passwordLength;
  }
  // confirmPassword is optional for API clients, but checked whenever it is sent.
  if (confirmPassword !== undefined && password && confirmPassword !== password) {
    fieldErrors.confirmPassword = MESSAGES.passwordMismatch;
  }

  const anyBlank = !username || !email || !password || confirmPassword === '';
  return { values: { username, email, password }, fieldErrors, error: summarize(fieldErrors, anyBlank) };
}

export const DISPLAY_NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;
// Avatars arrive as small base64 data URLs (the frontend resizes them to 256×256).
// SVG is deliberately excluded.
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
// users.avatar_url is VARCHAR(500), which is far too small for a data URL
// (~15–40 KB). Until images move to file storage (or the column is widened),
// uploads are rejected here with a friendly message instead of a DB error.
export const AVATAR_MAX_LENGTH = 500;

/**
 * Validates and normalizes profile edits.
 * username and email are required. displayName, bio and avatarUrl are optional:
 * undefined = leave unchanged ('' clears displayName/bio; null or '' removes the avatar).
 */
export function validateProfileUpdate(input = {}) {
  const username = asString(input.username).trim();
  const email = asString(input.email).trim().toLowerCase();
  // Optional fields: undefined = leave unchanged.
  const displayName =
    input.displayName === undefined ? undefined : asString(input.displayName).trim().replace(/\s+/g, ' ');
  const bio = input.bio === undefined ? undefined : asString(input.bio).trim();

  const fieldErrors = {};
  checkUsername(username, fieldErrors);
  checkEmail(email, fieldErrors);
  if (displayName && displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    fieldErrors.displayName = `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (bio && bio.length > BIO_MAX_LENGTH) {
    fieldErrors.bio = `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
  }

  let avatarUrl;
  if (input.avatarUrl === null || input.avatarUrl === '') {
    avatarUrl = null;
  } else if (input.avatarUrl !== undefined) {
    avatarUrl = asString(input.avatarUrl);
    if (avatarUrl.length > AVATAR_MAX_LENGTH) {
      fieldErrors.avatarUrl = 'Profile picture uploads aren’t available yet. Please try again later.';
    } else if (!AVATAR_PATTERN.test(avatarUrl)) {
      fieldErrors.avatarUrl = 'Profile picture must be a PNG, JPEG or WebP image.';
    }
  }

  return {
    values: { username, email, displayName, bio, avatarUrl },
    fieldErrors,
    error: summarize(fieldErrors, !username || !email),
  };
}

/** Login only checks presence. Format errors must not hint at which accounts exist. */
export function validateLogin(input = {}) {
  const identifier = asString(input.identifier).trim();
  const password = asString(input.password);
  const error = !identifier || !password ? MESSAGES.required : null;
  return { values: { identifier, password }, error };
}

// ---------- Sprint 3: music, reviews, diary, comments ----------

const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** MusicBrainz IDs are UUIDs. Checked before any MusicBrainz or MySQL call. */
export function isMbid(value) {
  return typeof value === 'string' && MBID_PATTERN.test(value);
}

/** Positive integer from a route parameter, or null. */
export function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && String(id) === String(value) ? id : null;
}

export const TARGET_TYPES = ['album', 'song'];
export const REVIEW_MAX_LENGTH = 5000;
export const COMMENT_MAX_LENGTH = 1000;
export const DIARY_NOTES_MAX_LENGTH = 1000;
// Ratings are 0.5–5 stars in half-star steps everywhere (ratings.score is DECIMAL(2,1)
// with CHECK score BETWEEN 0.5 AND 5.0).
export const RATING_MIN = 0.5;
export const RATING_MAX = 5;

/**
 * Normalizes user-written text: unifies line endings, removes invisible control
 * characters and trims. The text is stored as-is otherwise; React escapes it
 * when rendering, so HTML in a review shows up as literal text (no XSS).
 */
export function cleanText(value) {
  return asString(value)
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function checkTarget(input, fieldErrors) {
  const targetType = asString(input.targetType);
  const mbid = asString(input.mbid).trim().toLowerCase();
  if (!TARGET_TYPES.includes(targetType)) fieldErrors.targetType = 'Choose an album or song.';
  else if (!isMbid(mbid)) fieldErrors.mbid = 'That isn’t a valid music ID.';
  return { targetType, mbid };
}

function checkRating(value, fieldErrors) {
  const rating = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (rating === undefined || rating === null || rating === '') {
    fieldErrors.rating = 'Please choose a rating.';
    return null;
  }
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < RATING_MIN || rating > RATING_MAX || (rating * 2) % 1 !== 0) {
    fieldErrors.rating = `Rating must be between ${RATING_MIN} and ${RATING_MAX} stars, in half-star steps.`;
    return null;
  }
  return rating;
}

function checkReviewText(value, fieldErrors) {
  const text = cleanText(value);
  if (!text) fieldErrors.text = 'Review text cannot be empty.';
  else if (text.length > REVIEW_MAX_LENGTH) fieldErrors.text = `Reviews must be ${REVIEW_MAX_LENGTH} characters or fewer.`;
  return text;
}

const firstError = (fieldErrors) => Object.values(fieldErrors)[0] ?? null;

/** POST /api/reviews body: { targetType, mbid, text, rating } */
export function validateNewReview(input = {}) {
  const fieldErrors = {};
  const { targetType, mbid } = checkTarget(input, fieldErrors);
  const text = checkReviewText(input.text, fieldErrors);
  const rating = checkRating(input.rating, fieldErrors);
  return { values: { targetType, mbid, text, rating }, fieldErrors, error: firstError(fieldErrors) };
}

/** PATCH /api/reviews/:id body: { text, rating } (both required; the form always sends both) */
export function validateReviewUpdate(input = {}) {
  const fieldErrors = {};
  const text = checkReviewText(input.text, fieldErrors);
  const rating = checkRating(input.rating, fieldErrors);
  return { values: { text, rating }, fieldErrors, error: firstError(fieldErrors) };
}

export function validateComment(input = {}) {
  const fieldErrors = {};
  const text = cleanText(input.text);
  if (!text) fieldErrors.text = 'Comment cannot be empty.';
  else if (text.length > COMMENT_MAX_LENGTH) fieldErrors.text = `Comments must be ${COMMENT_MAX_LENGTH} characters or fewer.`;
  return { values: { text }, fieldErrors, error: firstError(fieldErrors) };
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "YYYY-MM-DD" listening date: a real calendar date, not before 1900 and not
 * in the future. One day of slack covers users whose local date is ahead of UTC.
 */
function checkListenedOn(value, fieldErrors) {
  const listenedOn = asString(value).trim();
  const match = DATE_PATTERN.exec(listenedOn);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!listenedOn) fieldErrors.listenedOn = 'Please choose the date you listened.';
  else if (!date || date.toISOString().slice(0, 10) !== listenedOn) fieldErrors.listenedOn = 'Please enter a valid date.';
  else if (+match[1] < 1900) fieldErrors.listenedOn = 'Listening date must be in 1900 or later.';
  else if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) fieldErrors.listenedOn = 'Listening date can’t be in the future.';
  return listenedOn;
}

function checkNotes(value, fieldErrors) {
  const notes = cleanText(value);
  if (notes.length > DIARY_NOTES_MAX_LENGTH) fieldErrors.notes = `Notes must be ${DIARY_NOTES_MAX_LENGTH} characters or fewer.`;
  return notes;
}

/** POST /api/diary body: { targetType, mbid, listenedOn, notes? } */
export function validateNewDiaryEntry(input = {}) {
  const fieldErrors = {};
  const { targetType, mbid } = checkTarget(input, fieldErrors);
  const listenedOn = checkListenedOn(input.listenedOn, fieldErrors);
  const notes = checkNotes(input.notes, fieldErrors);
  return { values: { targetType, mbid, listenedOn, notes }, fieldErrors, error: firstError(fieldErrors) };
}

/** PATCH /api/diary/:id body: { listenedOn, notes } */
export function validateDiaryUpdate(input = {}) {
  const fieldErrors = {};
  const listenedOn = checkListenedOn(input.listenedOn, fieldErrors);
  const notes = checkNotes(input.notes, fieldErrors);
  return { values: { listenedOn, notes }, fieldErrors, error: firstError(fieldErrors) };
}

export const DIARY_VISIBILITIES = ['public', 'private'];

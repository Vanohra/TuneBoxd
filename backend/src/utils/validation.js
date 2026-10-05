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

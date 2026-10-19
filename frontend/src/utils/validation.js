// Client-side validation for quick feedback. These mirror the backend rules in
// backend/src/utils/validation.js. The backend re-validates everything.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,30}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const EMAIL_MAX_LENGTH = 255;

function usernameError(username) {
  if (!username.trim()) return 'Username cannot be blank.';
  if (!USERNAME_PATTERN.test(username.trim())) {
    return 'Username must be 3–30 characters: letters, numbers, underscores or periods.';
  }
  return null;
}

function emailError(email) {
  if (!email.trim()) return 'Email cannot be blank.';
  if (email.trim().length > EMAIL_MAX_LENGTH) return `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  if (!EMAIL_PATTERN.test(email.trim())) return 'Please enter a valid email.';
  return null;
}

// Returns { error, fieldErrors }; error is null when the form is valid.
function result(fieldErrors, anyBlank) {
  const messages = Object.values(fieldErrors).filter(Boolean);
  if (messages.length === 0) return { error: null, fieldErrors: {} };
  return { error: anyBlank ? 'All fields are required.' : messages[0], fieldErrors };
}

export function validateSignUp({ username, email, password, confirmPassword }) {
  const fieldErrors = {
    username: usernameError(username),
    email: emailError(email),
    password: !password
      ? 'Password cannot be blank.'
      : password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH
        ? `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`
        : null,
    confirmPassword: !confirmPassword
      ? 'Please confirm your password.'
      : password && confirmPassword !== password
        ? 'Passwords do not match.'
        : null,
  };
  const anyBlank = !username.trim() || !email.trim() || !password || !confirmPassword;
  return result(fieldErrors, anyBlank);
}

export const DISPLAY_NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;

export function validateProfile({ username, email, displayName = '', bio = '' }) {
  const fieldErrors = {
    username: usernameError(username),
    email: emailError(email),
    displayName:
      displayName.trim().length > DISPLAY_NAME_MAX_LENGTH
        ? `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
        : null,
    bio: bio.trim().length > BIO_MAX_LENGTH ? `Bio must be ${BIO_MAX_LENGTH} characters or fewer.` : null,
  };
  return result(fieldErrors, !username.trim() || !email.trim());
}

export function validateLogin({ identifier, password }) {
  if (!identifier.trim() || !password) return { error: 'All fields are required.', fieldErrors: {} };
  return { error: null, fieldErrors: {} };
}

// Sprint 3: reviews, comments, diary (mirrors backend/src/utils/validation.js).

export const REVIEW_MAX_LENGTH = 5000;
export const COMMENT_MAX_LENGTH = 1000;
export const DIARY_NOTES_MAX_LENGTH = 1000;

export function validateReview({ text, rating }) {
  const fieldErrors = {
    rating: rating ? null : 'Please choose a rating.',
    text: !text.trim()
      ? 'Review text cannot be empty.'
      : text.trim().length > REVIEW_MAX_LENGTH
        ? `Reviews must be ${REVIEW_MAX_LENGTH} characters or fewer.`
        : null,
  };
  return result(fieldErrors, false);
}

/** Returns an error message, or null when the comment is OK. */
export function validateCommentText(text) {
  if (!text.trim()) return 'Comment cannot be empty.';
  if (text.trim().length > COMMENT_MAX_LENGTH) return `Comments must be ${COMMENT_MAX_LENGTH} characters or fewer.`;
  return null;
}

/** `today` is the local "YYYY-MM-DD" date; "YYYY-MM-DD" strings compare correctly as text. */
export function validateDiaryEntry({ listenedOn, notes }, today) {
  const fieldErrors = {
    listenedOn: !listenedOn
      ? 'Please choose the date you listened.'
      : listenedOn > today
        ? 'Listening date can’t be in the future.'
        : listenedOn < '1900-01-01'
          ? 'Listening date must be in 1900 or later.'
          : null,
    notes:
      notes.trim().length > DIARY_NOTES_MAX_LENGTH ? `Notes must be ${DIARY_NOTES_MAX_LENGTH} characters or fewer.` : null,
  };
  return result(fieldErrors, false);
}

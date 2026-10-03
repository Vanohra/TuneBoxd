/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Small fetch wrapper for the TuneBoxd API.
 * The browser sends the HTTP-only session cookie automatically (same origin
 * through the Vite proxy); the frontend never reads or stores it.
 */
export async function apiRequest(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the backend running?');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.error ||
      (response.status >= 500
        ? 'Could not reach the server. Is the backend running?'
        : 'Something went wrong. Please try again.');
    throw new ApiError(response.status, message, data.fieldErrors || {});
  }
  return data;
}

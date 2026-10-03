/** An expected, user-facing error with an HTTP status (e.g. validation failures). */
export class ServiceError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/*
 * The one error type the render-job HTTP layer treats specially.
 *
 * Extracted from storage.js so both the job store (jobs.js) and the blob
 * adapter (blob.js) can raise it without importing the module that selects
 * between them — storage.js imports both, so anything they imported back from
 * it would be a cycle.
 *
 * Raising this is a deliberate statement: the request was fine, we are not
 * configured to serve it. http.js turns it into a 503 with the message intact,
 * because "you have not provisioned the blob store yet" is something the
 * operator needs to read, not a generic 500.
 */
export class StorageUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

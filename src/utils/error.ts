export class RedisMissedError extends Error {
  constructor(msg: string) {
    super(msg);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, RedisMissedError.prototype);
  }
}

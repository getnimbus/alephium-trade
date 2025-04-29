export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Function execution timed out after ${timeout}ms`);
    this.name = "TimeoutError";
  }
}

export const timeoutPromise = (timeout: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      return reject(new TimeoutError(timeout));
    }, timeout);
  });
};

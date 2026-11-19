/** Serialize full settings snapshots so an older asynchronous save cannot win. */
export function createSettingsWriter<T>(save: (next: T) => Promise<unknown>) {
  let tail: Promise<unknown> = Promise.resolve();
  return (next: T) => {
    const snapshot = structuredClone(next);
    const write = tail.then(() => save(snapshot));
    // A failed write must not prevent later preferences from being saved.
    tail = write.catch(() => undefined);
    return write;
  };
}

/** Runs `task` over `items` with at most `size` in flight at once. */
export async function runWithConcurrency<T>(
  items: T[],
  size: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.max(1, Math.min(size, queue.length || 1)) },
    async () => {
      for (;;) {
        const next = queue.shift();
        if (next === undefined) return;
        await task(next);
      }
    },
  );
  await Promise.all(workers);
}

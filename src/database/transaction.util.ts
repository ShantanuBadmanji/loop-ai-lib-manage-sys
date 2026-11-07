import { ClientSession, Connection } from 'mongoose';

const MAX_RETRIES = 3;

function hasErrorLabel(error: unknown, label: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errorLabels' in error &&
    Array.isArray((error as { errorLabels?: unknown }).errorLabels) &&
    ((error as { errorLabels: string[] }).errorLabels.includes(label))
  );
}

/**
 * Runs `work` inside a MongoDB transaction, threading a single session to every
 * participating write. Retries on transient transaction errors so concurrent
 * operations converge instead of surfacing spurious failures.
 */
export async function withTransaction<T>(
  connection: Connection,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    const session = await connection.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result!;
    } catch (error) {
      const retryable =
        hasErrorLabel(error, 'TransientTransactionError') ||
        hasErrorLabel(error, 'UnknownTransactionCommitResult');
      if (retryable && attempt < MAX_RETRIES) {
        attempt += 1;
        continue;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

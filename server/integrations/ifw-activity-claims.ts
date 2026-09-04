import type { Pool, PoolClient } from "@neondatabase/serverless";
import { pool } from "../db";

const DEFAULT_CLEANUP_BATCH_SIZE = 500;
const DEFAULT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

export type IfwActivityClaimResult =
  | "claimed"
  | "duplicate"
  | "rate_limited"
  | "unavailable";

export interface IfwActivityClaimStore {
  claim(input: {
    userId: string;
    dedupeKey: string;
    now: Date;
    windowMs: number;
    maxPerWindow: number;
  }): Promise<IfwActivityClaimResult>;
}

type QueryablePool = Pick<Pool, "query">;

export async function deleteExpiredIfwActivityClaims(
  databasePool: QueryablePool = pool,
  options: { now?: Date; batchSize?: number } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_CLEANUP_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError("IFW activity claim cleanup batch size must be a positive integer");
  }

  const result = await databasePool.query(
    `delete from ifw_activity_claims
      where ctid in (
        select ctid
        from ifw_activity_claims
        where expires_at <= $1
        order by expires_at
        for update skip locked
        limit $2
      )`,
    [now, batchSize],
  );
  return result.rowCount ?? 0;
}

export function startIfwActivityClaimCleanup(options: {
  intervalMs?: number;
  batchSize?: number;
  onError?: (error: unknown) => void;
} = {}): void {
  const intervalMs = options.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
  const run = async () => {
    try {
      await deleteExpiredIfwActivityClaims(pool, { batchSize: options.batchSize });
    } catch (error) {
      options.onError?.(error);
    }
  };

  setTimeout(() => { void run(); }, 30_000).unref();
  setInterval(() => { void run(); }, intervalMs).unref();
}

export class PostgresIfwActivityClaimStore implements IfwActivityClaimStore {
  constructor(private readonly databasePool: Pick<Pool, "connect"> = pool) {}

  async claim(input: {
    userId: string;
    dedupeKey: string;
    now: Date;
    windowMs: number;
    maxPerWindow: number;
  }): Promise<IfwActivityClaimResult> {
    const client = await this.databasePool.connect();
    try {
      await client.query("BEGIN");
      // Serialize claims for one user without blocking unrelated users.
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [input.userId],
      );
      await client.query(
        "delete from ifw_activity_claims where user_id = $1 and expires_at <= $2",
        [input.userId, input.now],
      );

      const duplicate = await client.query(
        "select 1 from ifw_activity_claims where dedupe_key = $1 and expires_at > $2 limit 1",
        [input.dedupeKey, input.now],
      );
      if (duplicate.rowCount) {
        await client.query("COMMIT");
        return "duplicate";
      }

      const windowStart = new Date(input.now.getTime() - input.windowMs);
      const recent = await client.query(
        "select count(*)::int as count from ifw_activity_claims where user_id = $1 and created_at > $2",
        [input.userId, windowStart],
      );
      if (Number(recent.rows[0]?.count ?? 0) >= input.maxPerWindow) {
        await client.query("COMMIT");
        return "rate_limited";
      }

      await client.query(
        `insert into ifw_activity_claims
          (dedupe_key, user_id, created_at, expires_at)
         values ($1, $2, $3, $4)`,
        [
          input.dedupeKey,
          input.userId,
          input.now,
          new Date(input.now.getTime() + input.windowMs),
        ],
      );
      await client.query("COMMIT");
      return "claimed";
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  private async rollback(client: PoolClient): Promise<void> {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original storage error.
    }
  }
}

export function createIfwActivityClaimHandler(
  store: IfwActivityClaimStore,
  options: {
    windowMs: number;
    maxPerWindow: number;
    onUnavailable?: (error: unknown) => void;
  },
) {
  return async (input: {
    userId: string;
    dedupeKey: string;
    now?: Date;
  }): Promise<IfwActivityClaimResult> => {
    try {
      return await store.claim({
        userId: input.userId,
        dedupeKey: input.dedupeKey,
        now: input.now ?? new Date(),
        windowMs: options.windowMs,
        maxPerWindow: options.maxPerWindow,
      });
    } catch (error) {
      options.onUnavailable?.(error);
      return "unavailable";
    }
  };
}

export const ifwActivityClaimStore = new PostgresIfwActivityClaimStore();
import postgres from "postgres";
import { env } from "./whisk.js";

// DATABASE_URL is pooled in transaction mode: no prepared statements across statements.
export const sql = postgres(env("DATABASE_URL"), { prepare: false, max: 5, onnotice: () => {}, connect_timeout: 10 });

export type Tx = postgres.TransactionSql;

// Who a query runs as: the person asking, or "system" for the app's own work.
export type Caller = { audience: "anonymous" | "customer" | "team" | "system"; userId: string };
export const system: Caller = { audience: "system", userId: "" };

// dbFor runs fn in one short transaction that first tells Postgres who is asking, so the tables
// with row-level security (people, votes, emails) answer only that caller's rows even when a
// query forgets its filter. Keep calls to other services outside fn.
export const dbFor = <T>(caller: Caller, fn: (tx: Tx) => Promise<T>): Promise<T> =>
  sql.begin(async (tx) => {
    await tx`select set_config('whisk.audience', ${caller.audience}, true), set_config('whisk.user_id', ${caller.userId}, true)`;
    return fn(tx);
  }) as Promise<T>;

export const asSystem = <T>(fn: (tx: Tx) => Promise<T>) => dbFor(system, fn);

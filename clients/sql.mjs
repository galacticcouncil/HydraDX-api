import PG from "pg";
import {
  primarySqlHost,
  primarySqlPort,
  primarySqlUser,
  primarySqlPass,
  primarySqlDatabase,
  fallbackSqlHost,
  fallbackSqlPort,
  fallbackSqlUser,
  fallbackSqlPass,
  fallbackSqlDatabase,
} from "../variables.mjs";

// Use a Pool capped at 1 connection and return the pool directly.
// Pool.query() handles acquire/release internally; pool.end() fully closes
// all connections — so callers must call pool.end() when done, not release().
async function newPoolClient({ host, port, user, password, database }) {
  const pool = new PG.Pool({
    host,
    port,
    user,
    password,
    database,
    max: 1,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  // Eagerly verify connectivity before returning.
  const client = await pool.connect();
  client.release();
  return pool;
}

// Tries primary host first, then fallback host.
// Returns the first pool that connects successfully (max: 1 connection).
// Caller must call pool.end() when done.
export async function newSqlClientWithFallback() {
  const sources = [
    {
      name: `primary (${primarySqlHost()})`,
      connect: () =>
        newPoolClient({
          host: primarySqlHost(),
          port: primarySqlPort(),
          user: primarySqlUser(),
          password: primarySqlPass(),
          database: primarySqlDatabase(),
        }),
    },
    {
      name: `fallback (${fallbackSqlHost()})`,
      connect: () =>
        newPoolClient({
          host: fallbackSqlHost(),
          port: fallbackSqlPort(),
          user: fallbackSqlUser(),
          password: fallbackSqlPass(),
          database: fallbackSqlDatabase(),
        }),
    },
  ];

  let lastError;
  for (const { name, connect } of sources) {
    try {
      const client = await connect();
      console.log(`[sql] Connected to ${name}`);
      return client;
    } catch (err) {
      console.warn(`[sql] Failed to connect to ${name}: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(
    `[sql] All database sources failed. Last error: ${lastError?.message}`
  );
}

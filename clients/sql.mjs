import PG from "pg";
import {
  orcaSqlHost,
  orcaSqlPort,
  orcaSqlUser,
  orcaSqlPass,
  orcaSqlDatabase,
  fallbackSqlHosts,
  fallbackSqlPort,
  fallbackSqlUser,
  fallbackSqlPass,
  fallbackSqlDatabase,
} from "../variables.mjs";

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
  const client = await pool.connect();
  return client;
}

export async function newOrcaSqlClient() {
  return newPoolClient({
    host: orcaSqlHost(),
    port: orcaSqlPort(),
    user: orcaSqlUser(),
    password: orcaSqlPass(),
    database: orcaSqlDatabase(),
  });
}

// Tries orca first, then each fallback host in order.
// Returns the first client that connects successfully.
export async function newSqlClientWithFallback() {
  const sources = [
    {
      name: "orca (pg.squid.subsquid.io)",
      connect: () => newOrcaSqlClient(),
    },
    ...fallbackSqlHosts().map((host, i) => ({
      name: `fallback-${i + 1} (${host})`,
      connect: () =>
        newPoolClient({
          host,
          port: fallbackSqlPort(),
          user: fallbackSqlUser(),
          password: fallbackSqlPass(),
          database: fallbackSqlDatabase(),
        }),
    })),
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

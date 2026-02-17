import PG from "pg";
import {
  orcaSqlHost,
  orcaSqlPort,
  orcaSqlUser,
  orcaSqlPass,
  orcaSqlDatabase,
} from "../variables.mjs";

export async function newOrcaSqlClient() {
  const pool = new PG.Pool({
    host: orcaSqlHost(),
    port: orcaSqlPort(),
    user: orcaSqlUser(),
    password: orcaSqlPass(),
    database: orcaSqlDatabase(),
    max: 1,
    min: 0,
    idleTimeoutMillis: 30000,
  });

  const client = await pool.connect();
  return client;
}

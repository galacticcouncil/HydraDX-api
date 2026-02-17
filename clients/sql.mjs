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
    max: 500,
  });

  const client = await pool.connect();
  return client;
}

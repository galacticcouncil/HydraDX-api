import PG from "pg";
import {
  sqlPort,
  sqlHost,
  sqlUser,
  sqlPass,
  sqlDatabase,
  orcaSqlHost,
  orcaSqlPort,
  orcaSqlUser,
  orcaSqlPass,
  orcaSqlDatabase,
} from "../variables.mjs";

export async function newSqlClient() {
  const pool = new PG.Pool({
    host: sqlHost(),
    port: sqlPort(),
    user: sqlUser(),
    password: sqlPass(),
    database: sqlDatabase(),
    max: 500,
  });

  const client = await pool.connect();
  return client;
}

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

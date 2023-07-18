import PG from "pg";
import {
  sqlPort,
  sqlHost,
  sqlUser,
  sqlPass,
  sqlDatabase,
} from "../variables.mjs";

export async function newSqlClient() {
  const pool = new PG.Pool({
    host: sqlHost(),
    port: sqlPort(),
    user: sqlUser(),
    password: sqlPass(),
    database: sqlDatabase(),
    max: 22,
  });

  const client = await pool.connect();
  return client;
}

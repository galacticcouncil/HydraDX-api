import PG from "pg";
import { sqlUri } from "../variables.mjs";

export async function newSqlClient() {
  const client = new PG.Client({
    connectionString: sqlUri(),
  });

  await client.connect();
  return client;
}

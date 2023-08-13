export async function getAssets(sqlClient) {
  const { rows } = await sqlClient.query("SELECT * FROM public.token_metadata");

  return rows.map((v) => v["symbol"]);
}

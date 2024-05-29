export async function fetchFromSql(sqlClient, qry) {
  const { rows } = await sqlClient.query(qry);

  return rows;
}

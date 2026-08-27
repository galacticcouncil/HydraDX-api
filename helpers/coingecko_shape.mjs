import { neckworkGet } from "../clients/neckwork.mjs";
import { coingeckoLiquiditySource } from "../variables.mjs";

// neckwork publishes one row per (pool, pair), names the real pool in pool_id
// and reports real depth. the incumbent tickers.sql published one aggregated
// row per pair, repeated ticker_id in pool_id and hardcoded liquidity to 0.
// everything here exists to hand CoinGecko the incumbent's shape unchanged.

const num = (value) =>
  value === null || value === undefined ? 0 : Number(value);

// incumbent applied ROUND(x, 12) to every numeric column
function round12(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return n;
  return Number(n.toFixed(12));
}

// deepest pool wins, pool_id breaks ties so the pick never flaps
function isDeeper(row, incumbentLead) {
  if (!incumbentLead) return true;
  const rowVolume = num(row.base_volume);
  const leadVolume = num(incumbentLead.base_volume);
  if (rowVolume !== leadVolume) return rowVolume > leadVolume;
  return String(row.pool_id) < String(incumbentLead.pool_id);
}

export function toIncumbentTickers(rows, { liquidity = "incumbent" } = {}) {
  if (!Array.isArray(rows)) {
    throw new Error("[coingecko] upstream tickers payload is not an array");
  }

  const pairs = new Map();

  for (const row of rows) {
    const base = row?.base_currency;
    const target = row?.target_currency;
    if (!base || !target) continue;

    const tickerId = `${base}_${target}`;
    let pair = pairs.get(tickerId);

    if (!pair) {
      pair = {
        ticker_id: tickerId,
        base_currency: base,
        target_currency: target,
        base_volume: 0,
        target_volume: 0,
        liquidity_in_usd: 0,
        high: null,
        low: null,
        lead: null,
      };
      pairs.set(tickerId, pair);
    }

    pair.base_volume += num(row.base_volume);
    pair.target_volume += num(row.target_volume);
    pair.liquidity_in_usd += num(row.liquidity_in_usd);

    const high = num(row.high);
    const low = num(row.low);
    if (pair.high === null || high > pair.high) pair.high = high;
    if (pair.low === null || low < pair.low) pair.low = low;

    // incumbent's last_price was the pair's most recent fill across every pool.
    // per-pool rows carry no block, so the deepest pool stands in — it only
    // decides anything for the three pairs that trade in more than one pool.
    if (isDeeper(row, pair.lead)) pair.lead = row;
  }

  return [...pairs.values()]
    .sort((a, b) =>
      a.ticker_id > b.ticker_id ? 1 : a.ticker_id < b.ticker_id ? -1 : 0
    )
    .map((pair) => ({
      ticker_id: pair.ticker_id,
      base_currency: pair.base_currency,
      target_currency: pair.target_currency,
      last_price: round12(num(pair.lead?.last_price)),
      base_volume: round12(pair.base_volume),
      target_volume: round12(pair.target_volume),
      pool_id: pair.ticker_id,
      liquidity_in_usd:
        liquidity === "real" ? round12(pair.liquidity_in_usd) : 0,
      high: round12(pair.high),
      low: round12(pair.low),
    }));
}

export async function fetchIncumbentTickers() {
  const rows = await neckworkGet("/coingecko/v1/tickers");
  return toIncumbentTickers(rows, { liquidity: coingeckoLiquiditySource() });
}

import { test } from "tap";
import { toIncumbentTickers } from "../../../helpers/coingecko_shape.mjs";

// two pools of the same pair, plus a single-pool pair
const upstream = [
  {
    ticker_id: "HOLLAR_USDC",
    base_currency: "HOLLAR",
    target_currency: "USDC",
    last_price: 1.5,
    base_volume: 100,
    target_volume: 150,
    pool_id: "stableswap:105",
    liquidity_in_usd: 1000,
    high: 1.9,
    low: 1.4,
  },
  {
    ticker_id: "HOLLAR_USDC",
    base_currency: "HOLLAR",
    target_currency: "USDC",
    last_price: 2.5,
    base_volume: 300,
    target_volume: 750,
    pool_id: "stableswap:110",
    liquidity_in_usd: 2000,
    high: 1.8,
    low: 1.2,
  },
  {
    ticker_id: "DOT_H2O",
    base_currency: "DOT",
    target_currency: "H2O",
    last_price: 6.5,
    base_volume: 10,
    target_volume: 65,
    pool_id: "omnipool",
    liquidity_in_usd: 500,
    high: 7,
    low: 6,
  },
];

test("collapses per-pool rows into one row per pair", async (t) => {
  const out = toIncumbentTickers(upstream);

  t.equal(out.length, 2);
  t.same(
    out.map((r) => r.ticker_id),
    ["DOT_H2O", "HOLLAR_USDC"],
    "sorted by ticker_id"
  );

  const hollar = out.find((r) => r.ticker_id === "HOLLAR_USDC");
  t.equal(hollar.base_volume, 400, "base volume sums across pools");
  t.equal(hollar.target_volume, 900, "target volume sums across pools");
  t.equal(hollar.high, 1.9, "high is the max across pools");
  t.equal(hollar.low, 1.2, "low is the min across pools");
  t.equal(hollar.last_price, 2.5, "last price comes from the deepest pool");
});

test("keeps the incumbent field order and pool_id convention", async (t) => {
  const out = toIncumbentTickers(upstream);

  t.same(Object.keys(out[0]), [
    "ticker_id",
    "base_currency",
    "target_currency",
    "last_price",
    "base_volume",
    "target_volume",
    "pool_id",
    "liquidity_in_usd",
    "high",
    "low",
  ]);
  t.ok(
    out.every((r) => r.pool_id === r.ticker_id),
    "pool_id repeats ticker_id"
  );
});

test("liquidity_in_usd defaults to the incumbent's hardcoded zero", async (t) => {
  t.ok(toIncumbentTickers(upstream).every((r) => r.liquidity_in_usd === 0));

  const real = toIncumbentTickers(upstream, { liquidity: "real" });
  t.equal(
    real.find((r) => r.ticker_id === "HOLLAR_USDC").liquidity_in_usd,
    3000,
    "real mode sums pool depth"
  );
});

test("rounds to 12 decimal places like the incumbent query", async (t) => {
  const out = toIncumbentTickers([
    { ...upstream[2], last_price: 1 / 3, base_volume: 1 / 3 },
  ]);

  t.equal(out[0].last_price, 0.333333333333);
  t.equal(out[0].base_volume, 0.333333333333);
});

test("guards against a malformed upstream payload", async (t) => {
  t.same(toIncumbentTickers([]), [], "empty upstream stays empty");
  t.throws(() => toIncumbentTickers({}), "non-array payload throws");
  t.same(
    toIncumbentTickers([{ base_currency: "DOT" }]),
    [],
    "rows missing a currency are dropped"
  );
});

import { test } from "tap";
import {
  aggregateByDay,
  totalsOf,
} from "../../../helpers/defillama_volume.mjs";

// 10 = USDT and 2 = DAI are hard $1 anchors in the price graph, so any fill with
// one of them on a side has a determined USD value. 1 = LRNA, the omnipool hub.
const USDT = 10;
const DAI = 2;
const LRNA = 1;
const SHARE = 999;

function fill(overrides) {
  return {
    day: "2026-08-20",
    hour: "2026-08-20T12",
    filler: "XYK",
    inAsset: USDT,
    inAmount: 100,
    outAsset: DAI,
    outAmount: 100,
    inIsPoolShare: false,
    outIsPoolShare: false,
    fees: [],
    ...overrides,
  };
}

const volumeOf = (fills) => totalsOf(aggregateByDay(fills)).volumeUsd;
const feesOf = (fills) => totalsOf(aggregateByDay(fills)).feesUsd;

test("omnipool counts one leg — the non-LRNA side", async (t) => {
  // 50 LRNA -> 100 USDT, so LRNA derives to $2 and both legs are worth $100
  t.equal(
    volumeOf([fill({ filler: "Omnipool", inAsset: LRNA, inAmount: 50 })]),
    100,
    "LRNA on the input side -> output leg counted"
  );

  t.equal(
    volumeOf([fill({ filler: "Omnipool", outAsset: LRNA, outAmount: 50 })]),
    100,
    "LRNA on the output side -> input leg counted"
  );
});

test("an omnipool route counts twice, once per hop", async (t) => {
  // A->LRNA then LRNA->B is how the router reports a single omnipool swap
  const hops = [
    fill({ filler: "Omnipool", outAsset: LRNA, outAmount: 50 }),
    fill({ filler: "Omnipool", inAsset: LRNA, inAmount: 50 }),
  ];
  t.equal(volumeOf(hops), 200, "$100 of trade reported as $200 of volume");
});

test("stableswap counts both legs, or one against its share token", async (t) => {
  t.equal(
    volumeOf([fill({ filler: "Stableswap" })]),
    200,
    "both sides are pool assets -> both legs"
  );

  t.equal(
    volumeOf([
      fill({ filler: "Stableswap", outAsset: SHARE, outIsPoolShare: true }),
    ]),
    100,
    "share token on the output -> input leg only"
  );

  t.equal(
    volumeOf([
      fill({ filler: "Stableswap", inAsset: SHARE, inIsPoolShare: true }),
    ]),
    100,
    "share token on the input -> output leg only"
  );
});

test("xyk counts both legs", async (t) => {
  t.equal(volumeOf([fill({ filler: "XYK" })]), 200);
});

test("aave, otc and hsm fills are not volume", async (t) => {
  for (const filler of ["Aave", "OTC", "HSM"]) {
    t.same(
      aggregateByDay([fill({ filler })]),
      {},
      `${filler} contributes nothing, not even a day bucket`
    );
  }
});

test("omnipool fees charged in LRNA are excluded", async (t) => {
  const base = { filler: "Omnipool", inAsset: LRNA, inAmount: 50 };

  t.equal(
    feesOf([fill({ ...base, fees: [{ asset: LRNA, amount: 5 }] })]),
    0,
    "LRNA is the hub, not a pool asset"
  );

  t.equal(
    feesOf([fill({ ...base, fees: [{ asset: USDT, amount: 5 }] })]),
    5,
    "a fee in a real pool asset counts"
  );
});

test("stableswap and xyk fees count whatever they are charged in", async (t) => {
  t.equal(
    feesOf([fill({ filler: "XYK", fees: [{ asset: USDT, amount: 3 }] })]),
    3
  );
  t.equal(
    feesOf([fill({ filler: "Stableswap", fees: [{ asset: DAI, amount: 2 }] })]),
    2
  );
});

test("volume is bucketed per UTC day", async (t) => {
  const byDay = aggregateByDay([
    fill({ day: "2026-08-20", hour: "2026-08-20T23" }),
    fill({ day: "2026-08-21", hour: "2026-08-21T00" }),
    fill({ day: "2026-08-21", hour: "2026-08-21T01" }),
  ]);

  t.same(Object.keys(byDay).sort(), ["2026-08-20", "2026-08-21"]);
  t.equal(byDay["2026-08-20"].volumeUsd, 200);
  t.equal(byDay["2026-08-21"].volumeUsd, 400);
  t.equal(totalsOf(byDay).volumeUsd, 600, "totals sum every day");
});

test("a fill with no priceable side is dropped, not counted as zero", async (t) => {
  // two assets that never touch an anchor cannot be valued
  const orphan = fill({ inAsset: 8001, outAsset: 8002 });
  t.same(aggregateByDay([orphan]), {});
});

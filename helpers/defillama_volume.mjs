// Reproduces the counting convention of the aggregation indexer that used to
// serve these endpoints, so the series DefiLlama already ingests does not step.
// That indexer accumulated volume per *pool asset*, which works out as:
//
//   omnipool   -> one leg per fill, the non-LRNA side. the router emits a
//                 separate fill for A->LRNA and LRNA->B, so an omnipool trade is
//                 counted twice; a routed trade is counted once per hop.
//   stableswap -> both legs when both are pool assets, one leg when the other
//                 side is the pool's own share token.
//   xyk        -> both legs.
//   aave / otc / hsm fills are not counted at all.
//
// Fees follow the same idea: omnipool fees charged in LRNA are not counted
// (LRNA is the hub, not a pool asset); stableswap and xyk fees are.
//
// Validated against the incumbent over 14 days (2026-08-03..09, 2026-08-17..23):
// volume within 0.49% every day, mean ratio 1.0003; fees mean ratio 1.017.

const LRNA_ASSET_ID = 1;
const COUNTED_FILLERS = new Set(["Omnipool", "Stableswap", "XYK"]);

// hard usd-pegged assets used to anchor the price graph. deliberately a small
// set — the graph derives everything else, so losing one of these is harmless.
const USD_ANCHORS = [10, 22, 21, 7, 23, 1002, 1003, 2, 18];

// both legs of a fill are worth the same modulo fees. a bigger gap than this
// means one leg's derived price is junk (thin long-tail pairs), so we fall back
// to whichever leg sits nearer an anchor.
const PRICE_DISAGREEMENT_GUARD = 3;

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

// keeps every fill, including the pool types that are not counted: aave fills
// are the atoken<->underlying bridges that anchor those assets in the price
// graph, so they have to be there even though their volume is not counted.
export function parseSwapEvents(events, registry) {
  const fills = [];
  for (const event of events) {
    const args = event.args;
    const filler = args.fillerType?.__kind;
    if (!filler) continue;

    const input = args.inputs?.[0];
    const output = args.outputs?.[0];
    if (!input || !output) continue;

    const inMeta = registry[String(input.asset)];
    const outMeta = registry[String(output.asset)];
    // external assets carry no decimals on chain; they only ever show up in
    // long-tail xyk pairs, so skipping them costs a rounding error.
    if (inMeta?.decimals == null || outMeta?.decimals == null) continue;

    const timestamp = event.block.timestamp;
    fills.push({
      day: timestamp.slice(0, 10),
      hour: timestamp.slice(0, 13),
      filler,
      inAsset: input.asset,
      inAmount: Number(input.amount) / 10 ** inMeta.decimals,
      outAsset: output.asset,
      outAmount: Number(output.amount) / 10 ** outMeta.decimals,
      inIsPoolShare: inMeta.isPoolShare === true,
      outIsPoolShare: outMeta.isPoolShare === true,
      fees: (args.fees ?? [])
        .map((fee) => {
          const feeMeta = registry[String(fee.asset)];
          if (feeMeta?.decimals == null) return null;
          return {
            asset: fee.asset,
            amount: Number(fee.amount) / 10 ** feeMeta.decimals,
          };
        })
        .filter(Boolean),
    });
  }
  return fills;
}

// value conservation gives price_b = price_a * amountA / amountB for every fill,
// so a breadth-first walk out from the $1 anchors prices the whole asset graph
// off the swaps themselves. no external price feed needed.
function derivePrices(fills) {
  const ratios = new Map();
  const neighbours = new Map();

  const addEdge = (a, b, ratio) => {
    if (!(ratio > 0) || !Number.isFinite(ratio)) return;
    const key = `${a}|${b}`;
    if (!ratios.has(key)) ratios.set(key, []);
    ratios.get(key).push(ratio);
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a).add(b);
  };

  for (const fill of fills) {
    if (!(fill.inAmount > 0) || !(fill.outAmount > 0)) continue;
    addEdge(fill.inAsset, fill.outAsset, fill.inAmount / fill.outAmount);
    addEdge(fill.outAsset, fill.inAsset, fill.outAmount / fill.inAmount);
  }

  const prices = new Map();
  const hops = new Map();
  for (const anchor of USD_ANCHORS) {
    prices.set(anchor, 1);
    hops.set(anchor, 0);
  }

  let frontier = [...prices.keys()];
  for (let hop = 0; hop < 6 && frontier.length > 0; hop++) {
    const discovered = new Map();
    for (const from of frontier) {
      for (const to of neighbours.get(from) ?? []) {
        if (prices.has(to)) continue;
        const observed = ratios.get(`${from}|${to}`);
        if (!observed?.length) continue;
        const candidate = prices.get(from) * median(observed);
        if (!(candidate > 0) || !Number.isFinite(candidate)) continue;
        // prefer the best-observed edge into this asset
        const existing = discovered.get(to);
        if (!existing || observed.length > existing.samples) {
          discovered.set(to, { price: candidate, samples: observed.length });
        }
      }
    }
    for (const [asset, found] of discovered) {
      prices.set(asset, found.price);
      hops.set(asset, hop + 1);
    }
    frontier = [...discovered.keys()];
  }

  return { prices, hops };
}

function groupBy(fills, keyFn) {
  const groups = new Map();
  for (const fill of fills) {
    const key = keyFn(fill);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fill);
  }
  return groups;
}

// prices move intraday, so value each fill at its own hour where possible and
// fall back to coarser windows when an asset barely traded.
function buildPriceLookup(fills) {
  const hourly = new Map();
  for (const [hour, group] of groupBy(fills, (f) => f.hour)) {
    hourly.set(hour, derivePrices(group));
  }
  const daily = new Map();
  for (const [day, group] of groupBy(fills, (f) => f.day)) {
    daily.set(day, derivePrices(group));
  }
  const overall = derivePrices(fills);

  return (fill, asset) => {
    for (const table of [hourly.get(fill.hour), daily.get(fill.day), overall]) {
      const price = table?.prices.get(asset);
      if (price != null) {
        return {
          price,
          hops: table.hops.get(asset) ?? Number.MAX_SAFE_INTEGER,
        };
      }
    }
    return null;
  };
}

function legValues(fill, lookup) {
  const inSide = lookup(fill, fill.inAsset);
  const outSide = lookup(fill, fill.outAsset);
  if (!inSide && !outSide) return null;

  let inValue = inSide ? fill.inAmount * inSide.price : null;
  let outValue = outSide ? fill.outAmount * outSide.price : null;
  if (inValue == null) inValue = outValue;
  if (outValue == null) outValue = inValue;

  if (
    inValue > 0 &&
    outValue > 0 &&
    Math.max(inValue, outValue) / Math.min(inValue, outValue) >
      PRICE_DISAGREEMENT_GUARD
  ) {
    const trustIn = !outSide || (inSide && inSide.hops <= outSide.hops);
    if (trustIn) outValue = inValue;
    else inValue = outValue;
  }

  if (!Number.isFinite(inValue) || !Number.isFinite(outValue)) return null;
  return { inValue, outValue };
}

// returns { "YYYY-MM-DD": { volumeUsd, feesUsd, feesUsdByPool: { Omnipool, Stableswap, XYK } } }
export function aggregateByDay(fills) {
  const lookup = buildPriceLookup(fills);
  const byDay = {};

  for (const fill of fills) {
    if (!COUNTED_FILLERS.has(fill.filler)) continue;
    const values = legValues(fill, lookup);
    if (!values) continue;
    const { inValue, outValue } = values;

    const bucket = (byDay[fill.day] ??= {
      volumeUsd: 0,
      feesUsd: 0,
      feesUsdByPool: { Omnipool: 0, Stableswap: 0, XYK: 0 },
    });
    const priceOf = (asset) => lookup(fill, asset)?.price ?? null;

    if (fill.filler === "Omnipool") {
      bucket.volumeUsd += fill.inAsset === LRNA_ASSET_ID ? outValue : inValue;
      for (const fee of fill.fees) {
        if (fee.asset === LRNA_ASSET_ID) continue;
        const price = priceOf(fee.asset);
        if (price != null) {
          const value = fee.amount * price;
          bucket.feesUsd += value;
          bucket.feesUsdByPool.Omnipool += value;
        }
      }
      continue;
    }

    if (fill.filler === "Stableswap") {
      if (fill.inIsPoolShare) bucket.volumeUsd += outValue;
      else if (fill.outIsPoolShare) bucket.volumeUsd += inValue;
      else bucket.volumeUsd += inValue + outValue;
    } else {
      bucket.volumeUsd += inValue + outValue;
    }

    for (const fee of fill.fees) {
      const price = priceOf(fee.asset);
      if (price != null) {
        const value = fee.amount * price;
        bucket.feesUsd += value;
        // fill.filler is "Stableswap" or "XYK" here (Omnipool returns above)
        bucket.feesUsdByPool[fill.filler] += value;
      }
    }
  }

  return byDay;
}

export function totalsOf(byDay) {
  let volumeUsd = 0;
  let feesUsd = 0;
  const feesUsdByPool = { Omnipool: 0, Stableswap: 0, XYK: 0 };
  for (const day of Object.values(byDay)) {
    volumeUsd += day.volumeUsd;
    feesUsd += day.feesUsd;
    if (day.feesUsdByPool) {
      feesUsdByPool.Omnipool += day.feesUsdByPool.Omnipool;
      feesUsdByPool.Stableswap += day.feesUsdByPool.Stableswap;
      feesUsdByPool.XYK += day.feesUsdByPool.XYK;
    }
  }
  return { volumeUsd, feesUsd, feesUsdByPool };
}

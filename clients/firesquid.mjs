import { gql, request as gqlRequest } from "graphql-request";
import {
  firesquidEndpoints,
  firesquidChunkBlocks,
  firesquidRowLimit,
} from "../variables.mjs";

// the firesquid archive keeps raw `block` + `event` rows for the whole chain and
// is fed straight off an rpc, so it does not stall when the aggregation indexer
// does. reads go through the archive's own substrate-explorer.

const LATEST_BLOCK = gql`
  {
    blocks(orderBy: height_DESC, limit: 1) {
      height
      timestamp
    }
  }
`;

const FIRST_BLOCK_AT = gql`
  query FirstBlockAt($ts: DateTime!) {
    blocks(where: { timestamp_gte: $ts }, orderBy: height_ASC, limit: 1) {
      height
      timestamp
    }
  }
`;

const SWAPS_IN_RANGE = gql`
  query SwapsInRange($from: Int!, $to: Int!, $limit: Int!) {
    events(
      where: {
        name_eq: "Broadcast.Swapped3"
        block: { height_gte: $from, height_lt: $to }
      }
      orderBy: id_ASC
      limit: $limit
    ) {
      args
      block {
        height
        timestamp
      }
    }
  }
`;

// tries each configured archive in turn; they are independent hosts indexing the
// same chain, so any healthy one is as good as another.
async function query(document, variables) {
  let lastError;
  for (const endpoint of firesquidEndpoints()) {
    try {
      return await gqlRequest(endpoint, document, variables);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `[firesquid] all archives failed. Last error: ${lastError?.message}`
  );
}

export async function latestBlock() {
  const data = await query(LATEST_BLOCK);
  const block = data.blocks[0];
  if (!block) throw new Error("[firesquid] archive returned no blocks");
  return { height: block.height, timestamp: new Date(block.timestamp) };
}

export async function firstBlockAtOrAfter(date) {
  const data = await query(FIRST_BLOCK_AT, { ts: date.toISOString() });
  const block = data.blocks[0];
  return block
    ? { height: block.height, timestamp: new Date(block.timestamp) }
    : null;
}

// height-chunked so every query stays inside the archive's statement timeout;
// `event.name` is unindexed there, but the block-height predicate is not.
export async function fetchSwapEvents(fromHeight, toHeight, onBatch) {
  const chunk = firesquidChunkBlocks();
  const limit = firesquidRowLimit();
  for (let from = fromHeight; from < toHeight; from += chunk) {
    const to = Math.min(from + chunk, toHeight);
    const data = await query(SWAPS_IN_RANGE, { from, to, limit });
    if (data.events.length >= limit) {
      throw new Error(
        `[firesquid] chunk ${from}-${to} hit the row limit; lower firesquidChunkBlocks`
      );
    }
    onBatch(data.events);
  }
}

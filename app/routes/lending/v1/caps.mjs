import { gql, request as gqlRequest } from "graphql-request";
import { CACHE_SETTINGS } from "../../../../variables.mjs";

const GRAPHQL_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:whale-prod/api/graphql";
const RPC_URL = "https://rpc.parm.hydration.cloud";

const HOLLAR_DECIMALS = 18;
const HOLLAR_VARIABLE_DEBT_TOKEN = "0x342923782ccaebf9c38dd9cb40436e82c42c73b5";

// ERC20 totalSupply function signature
const TOTAL_SUPPLY_SIGNATURE = "0x18160ddd";

/**
 * Normalize a value by dividing by 10^decimals
 * @param {string|bigint} value - The value to normalize
 * @param {number} decimals - Number of decimal places
 * @returns {number} The normalized value
 */
function normalize(value, decimals) {
  const bigValue = typeof value === "string" ? BigInt(value) : value;
  const divisor = BigInt(10 ** decimals);
  const integerPart = bigValue / divisor;
  const remainder = bigValue % divisor;
  
  // Format the decimal part with proper padding
  const decimalPart = remainder.toString().padStart(decimals, "0");
  
  // Combine and convert to number
  return parseFloat(`${integerPart}.${decimalPart}`);
}

/**
 * Call totalSupply function on an ERC20 contract via RPC
 * @param {string} contractAddress - The contract address
 * @returns {Promise<string>} The hex result from the RPC call
 */
async function callTotalSupply(contractAddress) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: contractAddress,
          data: TOTAL_SUPPLY_SIGNATURE,
        },
        "latest",
      ],
      id: 1,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "RPC call failed");
  }

  return data.result;
}

/**
 * Fetch Hollar borrow cap from the Aave Facilitator
 * @returns {Promise<number>} Hollar borrow cap
 */
async function fetchHollarBorrowCap() {
  const data = await gqlRequest(
    GRAPHQL_ENDPOINT,
    gql`
      query MyQuery {
        aaveFacilitatorHistoricalData(
          orderBy: PARA_BLOCK_HEIGHT_DESC
          condition: {
            facilitatorId: "0x8c0f3b9602374198974d2b2679d14a386f5b108e"
          }
          first: 1
        ) {
          nodes {
            bucketCapacity
          }
        }
      }
    `
  );

  const node = data.aaveFacilitatorHistoricalData.nodes[0];
  
  if (!node) {
    throw new Error("No Hollar borrow cap data found");
  }

  return normalize(node.bucketCapacity, HOLLAR_DECIMALS);
}

/**
 * Fetch Hollar current borrow level from variable debt token total supply
 * @returns {Promise<number>} Hollar current borrow level
 */
async function fetchHollarCurrentBorrow() {
  // Call the variable debt token contract via JSON-RPC
  const hexValue = await callTotalSupply(HOLLAR_VARIABLE_DEBT_TOKEN);
  
  // Convert hex to BigInt and normalize
  const rawSupply = BigInt(hexValue);
  
  return normalize(rawSupply, HOLLAR_DECIMALS);
}

/**
 * Fetch Hollar token data (cap and current borrow)
 * @returns {Promise<Object>} Hollar token cap data
 */
async function fetchHollarData() {
  // Fetch both cap and current borrow in parallel
  const [capacity, currentBorrow] = await Promise.all([
    fetchHollarBorrowCap(),
    fetchHollarCurrentBorrow(),
  ]);

  const available = capacity - currentBorrow;

  return {
    asset: "HOLLAR",
    borrowCap: capacity,
    currentBorrow: currentBorrow,
    available: available,
  };
}

/**
 * Fetch caps data for all money market assets
 * Currently only returns Hollar, but structured to be extensible
 * @returns {Promise<Array>} Array of asset cap data
 */
async function fetchCapsData() {
  // Fetch Hollar data
  const hollarData = await fetchHollarData();
  
  // TODO: Add other assets from mmReserveConfigHistoricalData
  // This structure allows easy extension with additional assets
  const assets = [hollarData];
  
  return assets;
}

export default async (fastify, opts) => {
  fastify.route({
    url: "/caps",
    method: ["GET"],
    schema: {
      description: "Borrow caps and current borrow levels for money market assets",
      tags: ["lending/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              asset: { 
                type: "string",
                description: "Asset name"
              },
              borrowCap: { 
                type: "number",
                description: "Maximum borrow capacity"
              },
              currentBorrow: { 
                type: "number",
                description: "Current borrow level"
              },
              available: { 
                type: "number",
                description: "Available capacity (borrowCap - currentBorrow)"
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        let cacheSetting = { ...CACHE_SETTINGS["lendingV1Caps"] };

        // Check cache first
        const cachedResult = await fastify.redis.get(cacheSetting.key);
        if (cachedResult) {
          return reply.send(JSON.parse(cachedResult));
        }

        // Fetch from GraphQL
        const capsData = await fetchCapsData();

        // Cache the result
        await fastify.redis.set(cacheSetting.key, JSON.stringify(capsData));
        await fastify.redis.expire(cacheSetting.key, cacheSetting.expire_after);

        reply.send(capsData);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ 
          error: "Failed to fetch lending caps data",
          message: error.message 
        });
      }
    },
  });
};

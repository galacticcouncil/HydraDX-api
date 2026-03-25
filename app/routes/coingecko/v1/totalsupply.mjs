const RPC_URL = "https://hydration-rpc.n.dwellir.com";

// Token contract addresses mapping (ERC20 tokens)
const TOKEN_CONTRACTS = {
  hollar: "0x531a654d1696ED52e7275A8cede955E82620f99a",
  gigadot: "0x34d5ffb83d14d82f87aaf2f13be895a3c814c2ad",
  gigaeth: "0x8a598fe3e3a471ce865332e330d303502a0e2f52",
};

// Token decimals mapping
const TOKEN_DECIMALS = {
  hollar: 18,
  gigadot: 18,
  gigaeth: 18,
  h2o: 12,
};

// Substrate tokens: pre-encoded storage keys for tokens.totalIssuance
const SUBSTRATE_STORAGE_KEYS = {
  h2o: "0x99971b5749ac43e0235e41b0d378691857c875e4cff74148e4628f264b974c805153cb1f00942ff401000000",
};

// ERC20 totalSupply function signature
const TOTAL_SUPPLY_SIGNATURE = "0x18160ddd";

async function callSubstrateTotalIssuance(storageKey) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "state_getStorage",
      params: [storageKey],
      id: 1,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "RPC call failed");
  }

  // Decode little-endian hex u128
  const hex = data.result.slice(2); // strip 0x
  const bytes = hex.match(/.{2}/g).reverse().join("");
  return BigInt("0x" + bytes);
}

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

export default async (fastify, opts) => {
  fastify.route({
    url: "/totalsupply/:token",
    method: ["GET"],
    schema: {
      description: "Get total supply of a token",
      tags: ["coingecko/v1"],
      params: {
        type: "object",
        properties: {
          token: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            result: { type: "string" },
          },
        },
        404: {
          description: "Token not found",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const token = request.params.token.toLowerCase();

      const decimals = TOKEN_DECIMALS[token];
      if (!decimals) {
        return reply.code(404).send({
          error: `Token '${token}' not found`,
        });
      }

      try {
        let rawSupply;
        const storageKey = SUBSTRATE_STORAGE_KEYS[token];
        if (storageKey) {
          rawSupply = await callSubstrateTotalIssuance(storageKey);
        } else {
          const contractAddress = TOKEN_CONTRACTS[token];
          rawSupply = BigInt(await callTotalSupply(contractAddress));
        }

        // Convert to human-readable format by dividing by 10^decimals
        const divisor = BigInt(10 ** decimals);
        const integerPart = rawSupply / divisor;
        const remainder = rawSupply % divisor;

        // Format the decimal part with proper padding
        const decimalPart = remainder.toString().padStart(decimals, "0");

        // Combine and remove trailing zeros
        const result = `${integerPart}.${decimalPart}`.replace(/\.?0+$/, "");

        reply.send({ result });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: "Failed to fetch total supply",
        });
      }
    },
  });
};

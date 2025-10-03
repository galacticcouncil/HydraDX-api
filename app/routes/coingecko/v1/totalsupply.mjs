import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const RPC_URL = "https://rpc.parm.hydration.cloud";

// Token contract addresses mapping
const TOKEN_CONTRACTS = {
  hollar: "0x531a654d1696ED52e7275A8cede955E82620f99a",
  // Add more tokens here as needed
};

// Token decimals mapping
const TOKEN_DECIMALS = {
  hollar: 18,
  // Add more tokens here as needed
};

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

      // Check if token exists in our mapping
      const contractAddress = TOKEN_CONTRACTS[token];
      if (!contractAddress) {
        return reply.code(404).send({
          error: `Token '${token}' not found`,
        });
      }

      const decimals = TOKEN_DECIMALS[token];

      try {
        // Execute cast call command
        const command = `cast call -r ${RPC_URL} ${contractAddress} 'totalSupply()'`;
        const { stdout } = await execAsync(command);

        // Parse the hex result
        const hexValue = stdout.trim();

        // Convert hex to BigInt
        const rawSupply = BigInt(hexValue);

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

import { gql, request as gqlRequest } from "graphql-request";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { cachedFetch } from "../../../../../helpers/cache_helpers.mjs";

const GRAPHQL_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:spot-price-dev/api/graphql";
const DECIMALS_ENDPOINT = "https://hydration.dipdup.net/api/rest/asset?id=";
const RPC_ENDPOINT = "wss://hydration-rpc.n.dwellir.com";

export default async (fastify, opts) => {
  fastify.route({
    url: "/tvl",
    method: ["GET"],
    schema: {
      description: "All asset TVLs with total, excluding asset ID 1.",
      tags: ["hydradx-ui/v2"],
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            assets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  asset_id: { type: "string" },
                  tvl_usd: { type: "number" },
                },
              },
            },
            total_tvl: { type: "number" },
          },
        },
      },
    },

    handler: async (request, reply) => {
      try {
        request.log.info("Fetching asset prices...");

        const priceQuery = gql`
          query {
            assetHistoricalData(first: 1000, orderBy: PARA_BLOCK_HEIGHT_DESC) {
              nodes {
                asset {
                  assetRegistryId
                }
                assetSpotPriceHistoricalDataByAssetInHistDataId {
                  nodes {
                    priceNormalised
                  }
                }
              }
            }
          }
        `;

        const priceData = await gqlRequest(GRAPHQL_ENDPOINT, priceQuery);

        const priceMap = new Map();
        for (const node of priceData.assetHistoricalData.nodes) {
          const id = node.asset?.assetRegistryId;
          const price =
            node.assetSpotPriceHistoricalDataByAssetInHistDataId.nodes[0]
              ?.priceNormalised;
          if (id && price && !priceMap.has(id)) {
            priceMap.set(id, parseFloat(price));
          }
        }

        const provider = new WsProvider(RPC_ENDPOINT);
        const api = await ApiPromise.create({ provider });

        const results = [];
        let totalTvl = 0;

        for (const assetId of priceMap.keys()) {
          try {
            const decimalRes = await fetch(`${DECIMALS_ENDPOINT}${assetId}`);
            const decimalJson = await decimalRes.json();
            const decimals = decimalJson.asset?.decimals;
            if (decimals == null) continue;

            let issuance;
            if (assetId === "0") {
              issuance = await api.query.balances.totalIssuance();
            } else {
              issuance = await api.query.tokens.totalIssuance(assetId);
            }

            const issuanceFloat = Number(issuance.toBigInt()) / 10 ** decimals;
            const tvlUsd = issuanceFloat * priceMap.get(assetId);

            results.push({
              asset_id: assetId,
              tvl_usd: Number(tvlUsd.toFixed(12)),
            });
            if (assetId !== "1") {
              totalTvl += tvlUsd;
            }
          } catch (e) {
            request.log.warn(`Skipping asset ${assetId}: ${e.message}`);
          }
        }

        await api.disconnect();

        request.log.info(`Computed TVLs for ${results.length} assets.`);
        request.log.info(`Total TVL USD: ${totalTvl}`);

        reply.send({
          assets: results,
          total_tvl: Number(totalTvl.toFixed(12)),
        });
      } catch (err) {
        request.log.error("Failed to compute TVLs", err);
        return reply.status(500).send({ error: "TVL computation failed" });
      }
    },
  });
};

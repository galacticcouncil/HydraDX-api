import { gql, request as gqlRequest } from "graphql-request";

const DECIMALS_ENDPOINT = "https://hydration.dipdup.net/api/rest/asset?id=";
const SPOT_PRICE_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:spot-price-dev/api/graphql";
const UNIFIED_GRAPHQL_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:unified-prod/api/graphql";

export default async (fastify, opts) => {
  // GraphQL-based volume calculation replacing the original SQL-based logic
  fastify.route({
    url: "/volume/:asset?",
    method: ["GET"],
    schema: {
      description: "Current 24h rolling trading volume for DefiLlama.",
      tags: ["defillama/v1"],
      params: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Asset (symbol). Leave empty for all assets.",
          },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              volume_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      request.log.info("Starting 24-hour volume calculation for DefiLlama");

      try {
        // First, get the list of omnipool and stableswap assets
        const [omnipoolAssetsData, stableAssetsData] = await Promise.all([
          gqlRequest(
            UNIFIED_GRAPHQL_ENDPOINT,
            gql`
              {
                omnipoolAssets {
                  nodes {
                    assetId
                  }
                }
              }
            `
          ),
          gqlRequest(
            UNIFIED_GRAPHQL_ENDPOINT,
            gql`
              {
                stableswapAssets {
                  nodes {
                    assetId
                  }
                }
              }
            `
          ),
        ]);

        const omnipoolIds = new Set(
          omnipoolAssetsData.omnipoolAssets.nodes.map((n) => n.assetId)
        );

        // Fetch volume and price data
        const [omnipoolVolumeData, stableVolumeData, priceData] =
          await Promise.all([
            gqlRequest(
              UNIFIED_GRAPHQL_ENDPOINT,
              gql`
                query ($assetIds: [String!]) {
                  omnipoolAssetHistoricalVolumesByPeriod(
                    filter: { period: _24H_, assetIds: $assetIds }
                  ) {
                    nodes {
                      assetId
                      assetVolume
                    }
                  }
                }
              `,
              { assetIds: [...omnipoolIds] }
            ),
            gqlRequest(
              UNIFIED_GRAPHQL_ENDPOINT,
              gql`
                query {
                  stableswapHistoricalVolumesByPeriod(
                    filter: { period: _24H_, poolIds: ["690", "102"] }
                  ) {
                    nodes {
                      poolId
                      assetVolumes {
                        assetRegistryId
                        swapVolume
                      }
                    }
                  }
                }
              `
            ),
            gqlRequest(
              SPOT_PRICE_ENDPOINT,
              gql`
                query {
                  assetHistoricalData(
                    first: 1000
                    orderBy: PARA_BLOCK_HEIGHT_DESC
                  ) {
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
              `
            ),
          ]);

        // Build price map
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

        // Accumulate volume data
        const volumeAccumulator = new Map();
        for (const entry of omnipoolVolumeData
          .omnipoolAssetHistoricalVolumesByPeriod.nodes) {
          volumeAccumulator.set(
            entry.assetId,
            (volumeAccumulator.get(entry.assetId) || 0n) +
              BigInt(entry.assetVolume)
          );
        }
        for (const node of stableVolumeData.stableswapHistoricalVolumesByPeriod
          .nodes) {
          for (const asset of node.assetVolumes) {
            volumeAccumulator.set(
              asset.assetRegistryId,
              (volumeAccumulator.get(asset.assetRegistryId) || 0n) +
                BigInt(asset.swapVolume)
            );
          }
        }

        // Calculate total volume in USD
        let totalVolume = 0;

        for (const [assetId, rawVolume] of volumeAccumulator.entries()) {
          try {
            const decimalRes = await fetch(`${DECIMALS_ENDPOINT}${assetId}`);
            const decimalJson = await decimalRes.json();
            const decimals = decimalJson.asset?.decimals;
            const price = priceMap.get(assetId);
            if (decimals == null || price == null) continue;
            const normalizedVolume = Number(rawVolume) / 10 ** decimals;
            const volumeUsd = normalizedVolume * price;
            
            totalVolume += volumeUsd;
          } catch (e) {
            request.log.warn(
              `Volume normalization failed for asset ${assetId}: ${e.message}`
            );
          }
        }

        // Return in the expected DefiLlama format
        const result = [{ volume_usd: Number(totalVolume.toFixed(12)) }];

        request.log.info("24-hour volume response for DefiLlama: " + JSON.stringify(result));
        reply.send(result);
      } catch (err) {
        request.log.error("Failed to compute 24-hour volume for DefiLlama", {
          error: err.message,
          stack: err.stack,
          name: err.name
        });
        return reply.status(500).send({ 
          error: "24-hour volume computation failed",
          details: err.message 
        });
      }
    },
  });
};

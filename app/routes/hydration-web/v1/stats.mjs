import { gql, request as gqlRequest } from "graphql-request";

const SPOT_PRICE_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:whale-prod/api/graphql";
const UNIFIED_GRAPHQL_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:unified-prod/api/graphql";
const XCM_API_ENDPOINT = "https://api.ocelloids.net/query/xcm";

export default async (fastify, opts) => {
  fastify.route({
    url: "/stats",
    method: ["GET"],
    schema: {
      description: "Stats displayed on the Hydration homepage",
      tags: ["hydration-web/v1"],
      response: {
        200: {
          description: "Data displayed on Hydration homepage",
          type: "object",
          properties: {
            tvl: { type: "number" },
            vol_30d: { type: "number" },
            xcm_vol_30d: { type: "number" },
            assets_count: { type: "number" },
            accounts_count: { type: "number" },
          },
        },
      },
    },
    handler: async (request, reply) => {
      request.log.info("Starting stats handler");

      try {
        const [
          omnipoolAssetsData,
          xykPoolsData,
          stableAssetsData,
          accountsData,
          tvlData,
          volumeData,
        ] = await Promise.all([
          gqlRequest(
            UNIFIED_GRAPHQL_ENDPOINT,
            gql`
              {
                omnipoolAssets {
                  nodes {
                    assetId
                  }
                  totalCount
                }
              }
            `
          ),
          gqlRequest(
            UNIFIED_GRAPHQL_ENDPOINT,
            gql`
              {
                xykpools {
                  nodes {
                    assetAId
                    assetBId
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
          gqlRequest(
            UNIFIED_GRAPHQL_ENDPOINT,
            gql`
              {
                accounts {
                  totalCount
                }
              }
            `
          ),
          gqlRequest(
            SPOT_PRICE_ENDPOINT,
            gql`
              {
                platformTotalTvl {
                  nodes {
                    totalTvlDecoratedNorm
                  }
                }
              }
            `
          ),
          gqlRequest(
            SPOT_PRICE_ENDPOINT,
            gql`
              {
                platformTotalVolumesByPeriod(filter: { period: _30D_ }) {
                  nodes {
                    totalVolNorm
                  }
                }
              }
            `
          ),
        ]);

        const omnipoolIds = new Set(
          omnipoolAssetsData.omnipoolAssets.nodes.map((n) => n.assetId)
        );
        const xykAssetIds = new Set();
        xykPoolsData.xykpools.nodes.forEach(({ assetAId, assetBId }) => {
          xykAssetIds.add(assetAId);
          xykAssetIds.add(assetBId);
        });
        const stableAssetIds = new Set(
          stableAssetsData.stableswapAssets.nodes.map((n) => n.assetId)
        );

        const allTradableAssets = new Set([
          ...omnipoolIds,
          ...xykAssetIds,
          ...stableAssetIds,
        ]);
        const assetsCount = allTradableAssets.size;
        const accountsCount = accountsData.accounts.totalCount;

        // Get 30-day volume from the new GraphQL query
        const vol30d = Number(
          volumeData.platformTotalVolumesByPeriod.nodes[0]?.totalVolNorm || 0
        );

        let xcmVol30d = 0;
        try {
          const xcmRes = await fetch(XCM_API_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: process.env.XCM_AUTH_HEADER,
            },
            body: JSON.stringify({
              args: {
                op: "transfers_by_network",
                criteria: { timeframe: "1 months" },
              },
            }),
          });

          const json = await xcmRes.json();
          const hydration = json.items?.find(
            (x) => x.network === "urn:ocn:polkadot:2034"
          );
          if (hydration) xcmVol30d = hydration.volumeUsd;
        } catch (e) {
          request.log.warn("Failed to fetch xcm volume", e);
        }

        // Get TVL from the new GraphQL query
        const tvl =
          tvlData.platformTotalTvl.nodes[0]?.totalTvlDecoratedNorm || 0;

        const result = {
          tvl: Number(tvl),
          vol_30d: vol30d,
          xcm_vol_30d: Number(xcmVol30d.toFixed(12)),
          assets_count: assetsCount,
          accounts_count: accountsCount,
        };

        request.log.info("Final stats response: " + JSON.stringify(result));
        reply.send(result);
      } catch (err) {
        request.log.error("Failed to compute stats", err);
        return reply.status(500).send({ error: "Stats computation failed" });
      }
    },
  });
};

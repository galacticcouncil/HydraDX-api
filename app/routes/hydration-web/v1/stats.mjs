import { gql, request as gqlRequest } from "graphql-request";
import { ApiPromise, WsProvider } from "@polkadot/api";

const DECIMALS_ENDPOINT = "https://hydration.dipdup.net/api/rest/asset?id=";
const SPOT_PRICE_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:spot-price-dev/api/graphql";
const UNIFIED_GRAPHQL_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:unified-prod/api/graphql";
const RPC_ENDPOINT = "wss://hydration-rpc.n.dwellir.com";

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
        request.log.info("Fetching GraphQL-based stats...");

        const omnipoolAssetsQuery = gql`
          query {
            omnipoolAssets {
              nodes {
                assetId
              }
              totalCount
            }
          }
        `;
        const xykPoolsQuery = gql`
          query {
            xykpools {
              nodes {
                assetAId
                assetBId
              }
            }
          }
        `;
        const stableAssetsQuery = gql`
          query {
            stableswapAssets {
              nodes {
                assetId
              }
            }
          }
        `;
        const accountsQuery = gql`
          query {
            accounts {
              totalCount
            }
          }
        `;

        const [
          omnipoolAssetsData,
          xykPoolsData,
          stableAssetsData,
          accountsData,
        ] = await Promise.all([
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, omnipoolAssetsQuery),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, xykPoolsQuery),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, stableAssetsQuery),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, accountsQuery),
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

        const omnipoolVolumeQuery = gql`
          query ($assetIds: [String!]) {
            omnipoolAssetHistoricalVolumesByPeriod(
              filter: { period: _1M_, assetIds: $assetIds }
            ) {
              nodes {
                assetId
                assetVolume
              }
            }
          }
        `;

        const stableVolumeQuery = gql`
          query {
            stableswapHistoricalVolumesByPeriod(
              filter: { period: _1M_, poolIds: ["690", "102"] }
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
        `;

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

        const [omnipoolVolumeData, stableVolumeData, priceData] =
          await Promise.all([
            gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, omnipoolVolumeQuery, {
              assetIds: [...omnipoolIds],
            }),
            gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, stableVolumeQuery),
            gqlRequest(SPOT_PRICE_ENDPOINT, priceQuery),
          ]);

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

        const volumeAccumulator = new Map();
        for (const entry of omnipoolVolumeData
          .omnipoolAssetHistoricalVolumesByPeriod.nodes) {
          volumeAccumulator.set(
            entry.assetId,
            (volumeAccumulator.get(entry.assetId) || 0n) +
              BigInt(entry.assetVolume) / 2n
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

        let vol30d = 0;
        for (const [assetId, rawVolume] of volumeAccumulator.entries()) {
          try {
            const decimalRes = await fetch(`${DECIMALS_ENDPOINT}${assetId}`);
            const decimalJson = await decimalRes.json();
            const decimals = decimalJson.asset?.decimals;
            const price = priceMap.get(assetId);
            if (decimals == null || price == null) continue;
            const normalizedVolume = Number(rawVolume) / 10 ** decimals;
            vol30d += normalizedVolume * price;
          } catch (e) {
            request.log.warn(
              `Volume normalization failed for asset ${assetId}: ${e.message}`
            );
          }
        }

        const xcmVol30d = vol30d / 2;

        const provider = new WsProvider(RPC_ENDPOINT);
        const api = await ApiPromise.create({ provider });

        let tvl = 0;
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

            if (assetId !== "1") {
              tvl += tvlUsd;
            }
          } catch (e) {
            request.log.warn(
              `TVL computation failed for asset ${assetId}: ${e.message}`
            );
          }
        }

        await api.disconnect();

        const result = {
          tvl: Number(tvl.toFixed(12)),
          vol_30d: Number(vol30d.toFixed(12)),
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

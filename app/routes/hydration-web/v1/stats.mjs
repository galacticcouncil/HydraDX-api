import { gql, request as gqlRequest } from "graphql-request";
import { ApiPromise, WsProvider } from "@polkadot/api";
import fetch from "node-fetch";

const DECIMALS_ENDPOINT = "https://hydration.dipdup.net/api/rest/asset?id=";
const SPOT_PRICE_ENDPOINT = "https://galacticcouncil.squids.live/hydration-pools:spot-price-dev/api/graphql";
const UNIFIED_GRAPHQL_ENDPOINT = "https://galacticcouncil.squids.live/hydration-pools:unified-prod/api/graphql";
const RPC_ENDPOINT = "wss://hydration-rpc.n.dwellir.com";
const XCM_API_ENDPOINT = "https://dev-api.ocelloids.net/query/xcm";
const XCM_AUTH_HEADER =
  "Bearer eyJhbGciOiJFZERTQSIsImtpZCI6IklSU1FYWXNUc0pQTm9kTTJsNURrbkJsWkJNTms2SUNvc0xBRi16dlVYX289In0.ewogICJpc3MiOiAiZGV2LWFwaS5vY2VsbG9pZHMubmV0IiwKICAianRpIjogIjAxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIiwKICAic3ViIjogInB1YmxpY0BvY2VsbG9pZHMiCn0K.bjjQYsdIN9Fx34S9Of5QSKxb8_aOtwURInOGSSc_DxrdZcnYWi-5nnZsh1v5rYWuRWNzLstX0h1ICSH_oAugAQ";

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
        const [omnipoolAssetsData, xykPoolsData, stableAssetsData, accountsData] = await Promise.all([
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, gql`{ omnipoolAssets { nodes { assetId } totalCount } }`),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, gql`{ xykpools { nodes { assetAId assetBId } } }`),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, gql`{ stableswapAssets { nodes { assetId } } }`),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, gql`{ accounts { totalCount } }`),
        ]);

        const omnipoolIds = new Set(omnipoolAssetsData.omnipoolAssets.nodes.map((n) => n.assetId));
        const xykAssetIds = new Set();
        xykPoolsData.xykpools.nodes.forEach(({ assetAId, assetBId }) => {
          xykAssetIds.add(assetAId);
          xykAssetIds.add(assetBId);
        });
        const stableAssetIds = new Set(stableAssetsData.stableswapAssets.nodes.map((n) => n.assetId));

        const allTradableAssets = new Set([...omnipoolIds, ...xykAssetIds, ...stableAssetIds]);
        const assetsCount = allTradableAssets.size;
        const accountsCount = accountsData.accounts.totalCount;

        const [omnipoolVolumeData, stableVolumeData, priceData] = await Promise.all([
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, gql`
            query ($assetIds: [String!]) {
              omnipoolAssetHistoricalVolumesByPeriod(filter: { period: _1M_, assetIds: $assetIds }) {
                nodes { assetId assetVolume }
              }
            }
          `, { assetIds: [...omnipoolIds] }),
          gqlRequest(UNIFIED_GRAPHQL_ENDPOINT, gql`
            query {
              stableswapHistoricalVolumesByPeriod(filter: { period: _1M_, poolIds: ["690", "102"] }) {
                nodes {
                  poolId
                  assetVolumes {
                    assetRegistryId
                    swapVolume
                  }
                }
              }
            }
          `),
          gqlRequest(SPOT_PRICE_ENDPOINT, gql`
            query {
              assetHistoricalData(first: 1000, orderBy: PARA_BLOCK_HEIGHT_DESC) {
                nodes {
                  asset { assetRegistryId }
                  assetSpotPriceHistoricalDataByAssetInHistDataId {
                    nodes { priceNormalised }
                  }
                }
              }
            }
          `)
        ]);

        const priceMap = new Map();
        for (const node of priceData.assetHistoricalData.nodes) {
          const id = node.asset?.assetRegistryId;
          const price = node.assetSpotPriceHistoricalDataByAssetInHistDataId.nodes[0]?.priceNormalised;
          if (id && price && !priceMap.has(id)) {
            priceMap.set(id, parseFloat(price));
          }
        }

        const volumeAccumulator = new Map();
        for (const entry of omnipoolVolumeData.omnipoolAssetHistoricalVolumesByPeriod.nodes) {
          volumeAccumulator.set(entry.assetId, (volumeAccumulator.get(entry.assetId) || 0n) + BigInt(entry.assetVolume) / 2n);
        }
        for (const node of stableVolumeData.stableswapHistoricalVolumesByPeriod.nodes) {
          for (const asset of node.assetVolumes) {
            volumeAccumulator.set(asset.assetRegistryId, (volumeAccumulator.get(asset.assetRegistryId) || 0n) + BigInt(asset.swapVolume));
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
            request.log.warn(`Volume normalization failed for asset ${assetId}: ${e.message}`);
          }
        }

        let xcmVol30d = 0;
        try {
          const xcmRes = await fetch(XCM_API_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: XCM_AUTH_HEADER,
            },
            body: JSON.stringify({
              args: {
                op: "transfers_by_network",
                criteria: { timeframe: "1 months" },
              },
            }),
          });

          const json = await xcmRes.json();
          const hydration = json.items?.find((x) => x.network === "urn:ocn:polkadot:2034");
          if (hydration) xcmVol30d = hydration.volumeUsd;
        } catch (e) {
          request.log.warn("Failed to fetch xcm volume", e);
        }

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
            if (assetId !== "1") tvl += tvlUsd;
          } catch (e) {
            request.log.warn(`TVL computation failed for asset ${assetId}: ${e.message}`);
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

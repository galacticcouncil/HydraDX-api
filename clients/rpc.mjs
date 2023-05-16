import { ApiPromise, WsProvider } from "@polkadot/api";
import { rpcUri } from "../variables.mjs";

async function newRpcClient() {
  const provider = new WsProvider(rpcUri());
  const client = await ApiPromise.create({ provider });

  return client;
}

export { newRpcClient };

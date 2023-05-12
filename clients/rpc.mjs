import {ApiPromise, WsProvider} from '@polkadot/api';
import {RPC_ADDR} from '../constants.mjs';

async function newRpcClient() {
  const provider = new WsProvider(RPC_ADDR);
  const client = await ApiPromise.create({ provider });

  return client
}

export {newRpcClient};

const { ApiPromise, WsProvider } = require('@polkadot/api');
const {RPC_ADDR} = require('../constants');

async function newRpcClient() {
  const provider = new WsProvider(RPC_ADDR);
  const client = await ApiPromise.create({ provider });

  return client
}

module.exports.newRpcClient = newRpcClient;

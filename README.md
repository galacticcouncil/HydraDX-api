# HydraDX-api
## Description
An API to satisfy your most hydrated needs.

## Running

### Dev
`npm run dev`

### Test
`npm run test`

### Production
`npm run start`

### Docker
`docker build -t hydradx-api .`  
`docker run -p 3000:3000 -d hydradx-api`

## Framework
Built using:
* [Fastify](https://www.fastify.io/docs/latest/) for API framework;
* [PolkadotJS/api](https://polkadot.js.org/docs/api/) for communication with RPC;
* [Subsquid](https://docs.subsquid.io/) for chain indexer / processor;
* [Redis](https://redis.io/docs/about/) for caching layer;

# HydraDX-api

## Description

An API to satisfy your most hydrated needs.

Docs: https://hydradx-api-app-2u5klwxkrq-ey.a.run.app/docs

## Running

### Dev

`npm run app-dev`

### Test

`npm run app-test`

### Production

`npm run app`

### Docker

`docker build -t hydradx-api .`  
`docker run -p 3000:3000 -d hydradx-api`

## Framework

Built using:

- [Fastify](https://www.fastify.io/docs/latest/) for API framework;
- [PolkadotJS/api](https://polkadot.js.org/docs/api/) for communication with RPC;
- [Subsquid](https://docs.subsquid.io/) for chain indexer / processor;
- [Redis](https://redis.io/docs/about/) for caching layer;

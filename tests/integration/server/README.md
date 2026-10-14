# Server integration tests

These cases exercise owned loopback protocol negotiation, authoritative state and
server lifecycle. Follow [test setup, execution and reporting](../../AGENTS.md#run-and-report).

From the absolute GeoRoids checkout directory:

```sh
npm run test:integration:server
./scripts/test-runner.sh tests/integration/server/player-motion-cross-real-sockets.test.ts
```

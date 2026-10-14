# Code integration tests

These scenarios exercise owned real transport and server lifecycle. Follow
[test setup, execution and reporting](../AGENTS.md#run-and-report).

From the absolute GeoRoids checkout directory:

```sh
npm run test:integration
./scripts/test-runner.sh tests/integration/server/player-motion-cross-real-sockets.test.ts --reporter=verbose
```

The runner discovers the complete server inventory through
`scripts/code-integration-runner.mjs`; a copied file list is not authoritative.

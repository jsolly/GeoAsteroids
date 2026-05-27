# AGENTS.md

@~/.agents/AGENTS.md

## Project

GeoAsteroids — a 2D multiplayer spaceship/asteroids game. Vite + TypeScript client (`src/`) talking to a Node WebSocket server (`server.ts` + `server/`) over `ws://`. Deployed to https://geoasteroids.com (Railway server, see `railway.json`). Node `>=22.0.0`.

## Commands

```shell
# Dev (Vite on :5173 + ws server on :3001 via concurrently)
npm run dev                # ./scripts/dev-server.sh
npm run dev:check          # status of dev servers
npm run dev:kill           # kill all tsx/vite/concurrently processes

# Build / typecheck / lint
npm run build              # tsc && vite build
npm run check:ts           # tsc --noEmit
npm run check:lint         # biome check .
npm run check:fix          # biome check --write .
npm run fix                # biome write + tsc + unit tests

# Tests
npm run test               # unit only (tests/unit/)
npm run test:all           # everything (vitest run)
npm run test:integration:browser   # browser tests via test-runner.sh
npm run test:integration:server    # server-side integration
npm run test:integration:component # component integration

# Single test file (integration must use the runner script — not raw vitest)
./scripts/test-runner.sh tests/integration/browser/sanity/<file>.test.ts --reporter=verbose
npx vitest run tests/unit/path/to.test.ts        # OK for unit tests only
```

**Use `./scripts/test-runner.sh` for integration tests** — it enforces single-instance execution. Running `npx vitest` directly opens multiple Vitest forks, each spawning a WebSocket client to `:3001`, which hits the connection rate limiter and fails. The `vitest.config.ts` is hard-coded to `singleFork`, `concurrent: false`, `maxConcurrency: 1`, `fileParallelism: false`; keep those settings.

## Architecture

### Two processes, one game

- **Client** (`src/`, served by Vite): rendering, input, prediction, HUD. Entry is `index.html` → bootstraps `GameController` (singleton) which wires `GameStateManager`, `PlayerManager`, `InputManager`, `NetworkManager`, `CollisionManager`.
- **Server** (`server.ts` → `server/`): authoritative game loop. `GameEngine` owns world state via `EntityManager`, `AsteroidManager`, deterministic `RNGService`. `WebSocketCore` (`server/communication/`) routes messages through `MessageHandler`. `GameStateBroadcaster` periodically pushes state. Bots run server-side.
- **Two WebSocket paths on the same server**: `/ws` for gameplay, `/logs` for forwarded client logs (`ClientLogger` writes them to `logs/client.log`). HTTP routes on the same port: `/health`, `/status` (HTML or JSON depending on Accept/UA), `/test-server-log`.

Vite dev proxies `/ws` to `ws://localhost:3001` so the client always connects via the Vite origin.

### Server-authoritative model

Asteroids and bots live on the server; clients render snapshots. Clients still simulate their local ship for responsiveness. `playerNetwork.ts` and `network/networkManager.ts` handle outbound (input/shoot) and inbound (state) messages. Shared message/payload types live in `shared-types.ts` (top level, imported by both client and server).

### Key client modules

- `src/core/gameController.ts` — top-level lifecycle (`newGame`, `startGame`, `setupNetworkDisconnectionHandler`).
- `src/core/eventLoop.ts` — render/update loop.
- `src/entities/{player,ship,roid,laser,bot}/` — entity classes + per-entity managers/renderers. `ShipMovementManager` and `ShipCombatManager` split ship behavior.
- `src/physics/collision/{CollisionManager,collisionDetection}.ts` — collision system.
- `src/network/networkManager.ts` + `services/ConnectionManager.ts` — WS lifecycle, reconnection, message dispatch.
- `src/rendering/{RenderEngine,canvas,boundaryRenderer,hud/}` — canvas + HUD.
- `src/input/{PlayerInput,MockPlayerInput,mouse}.ts` — input abstraction; `MockPlayerInput` is what tests drive.
- `src/constants/index.ts` — single source of truth for tuning, `LOGGING`, and `DEBUG` flags.

### Debug & logging

Debug behavior is **constants, not env vars**. To enable debug mode, edit `src/constants/index.ts`:

1. `LOGGING.GLOBAL_LOG_LEVEL = 'debug'`
2. `DEBUG.ENABLED = true`

Notable flags under `DEBUG.*`: `LOCAL_PLAYER.INVINCIBLE`, `BOT_PLAYER.{COUNT,MOVEMENT,LASERS,SPAWN_PROTECTION}`, `ROIDS.{INITIAL_COUNT,MOVEMENT,PLACE_ON_BOT}`, `PLACE_PLAYERS_NEAR_CENTER`. Client logs forward over `/logs` to the server; both ends append to:

- `logs/client.log` — client-side (forwarded over WS)
- `logs/server.log` — server-side

Filter with grep prefixes: `[KEYBINDINGS]`, `[GAME_LOOP]`, `[RENDERING]`, `[NETWORK]`, `[SHIP]`, `[LASER]`, `[COLLISION]`, `[GAME_CONTROLLER]`. See `.cursor/rules/browser-integration-testing.mdc` for the full debugging playbook.

## Tests

- `tests/unit/` — pure, fast. Run via `npm run test`.
- `tests/integration/server/` — vitest against server modules directly.
- `tests/integration/component/` — vitest with jsdom against client modules.
- `tests/integration/browser/` — Selenium/Playwright driving a real browser. Organized by scenario: `sanity/`, `laser/`, `collision/`, `roid/`. **Name each test for the user scenario it describes**, not the function under test — e.g. `bots-explode-and-respawn-after-asteroid-collision.test.ts` (what happens) over `test-bot-collision.test.ts` (what's tested). Screenshots land in `tests/integration/browser/screenshots/`.

Integration tests boot the dev servers if not already running. If a test hangs or fails strangely, run `npm run dev:kill` then re-run.

## Project conventions

- **No barrel files / re-exports** — import from the defining module.
- **Relative paths only** — no `@`-style aliases.
- **Biome** is the only linter/formatter (`biome.jsonc`); ESLint is gone.
- **Singletons via `getInstance()`** for the top-level managers (`GameController`, `PlayerManager`, `CollisionManager`, etc.) — wire through these, don't `new` them.
- **Shared types** go in `shared-types.ts` at repo root, not duplicated per side.
- **Conventional Commits** (`feat`, `fix`, `chore`, `refactor`, `test`, `perf`, `docs`) with a scope (e.g. `feat(network): ...`).
- **Scenario-style test names** — describe a real user/system event, not the function under test.

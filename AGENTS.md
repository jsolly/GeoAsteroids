# AGENTS.md

@.agents/AGENTS.md

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

## Cursor Cloud

This repo is self-contained for [Cursor Cloud Agents](.agents/docs/cloud-agents.md): fleet config lives in `.agents/` (subtree from dotagents), project rules in `.cursor/rules/`, dev boot in `.cursor/environment.json`.

- **Install:** `bash scripts/cloud-agent-install.sh` (`npm ci`, Playwright Chromium, `.env` from example) — automatic on cloud VM boot via `.cursor/environment.json`
- **Dev server:** `npm run dev` (Vite :5173 + ws :3001) — started via environment terminals
- **Integration tests:** always `./scripts/test-runner.sh`, never raw `npx vitest`
- **Fleet updates:** `./scripts/update-agents-subtree.sh`

## Cursor Cloud specific instructions

- **Node:** `package.json` requires `>=24`; `.nvmrc` is `24`. Cloud VMs may ship Node 22 — installs and tests still pass, but prefer Node 24 when available (`nvm use` / install from `.nvmrc`).

### Environment prerequisites

The VM has Node 22.x pre-installed via nvm; `cloud-agent-install.sh` switches to Node from `.nvmrc` (24). Native build dependencies for the `canvas` npm package (Cairo, Pango, libjpeg, libgif, librsvg dev headers) are pre-installed on the image. Playwright browsers are downloaded during `cloud-agent-install.sh` (not bundled on the base image). Current Playwright also needs **Chrome Headless Shell** (`chromium_headless_shell-*` under `~/.cache/ms-playwright/`); if browser E2E fails with “Executable doesn't exist … chrome-headless-shell”, run `npx playwright install chromium-headless-shell` once (if the download stalls at 100%, remove `~/.cache/ms-playwright/__dirlock` and unzip the zip under `/tmp/playwright-download-*` into that cache dir).

An empty `.env` file must exist at the repo root (the server startup uses `--env-file=.env`); if missing, create one with `touch .env`.

### Services

| Service | Port | Health / URL |
|---------|------|----------------|
| Vite (client + `/ws` proxy) | 5173 | `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` → `200` |
| Game server (HTTP + WS) | 3001 | `curl http://localhost:3001/health` |

Start both with `npm run dev` (`./scripts/dev-server.sh`). Status: `npm run dev:check`. Stop: `npm run dev:kill`. If integration tests hang or rate-limit, kill then restart dev before re-running `./scripts/test-runner.sh`.

**Background dev:** Prefer the `dev` terminal from `.cursor/environment.json`. If tmux sessions do not persist in the VM, `nohup npm run dev > /tmp/geo-dev.log 2>&1 &` works; tail `/tmp/geo-dev.log` for startup errors.

### Lint / tests (reference)

See **Commands** above. Browser E2E must use `./scripts/test-runner.sh` (never raw `npx vitest` on `tests/integration/`). As of May 2026, `npm run check:lint` may report a pre-existing Biome `organizeImports` issue in `src/entities/roid/roid.ts` (export order); typecheck and unit tests still pass.

### Hello-world smoke

With dev servers up: open `http://localhost:5173`, click Play, thrust (arrow keys) and fire (Space). Or run `./scripts/test-runner.sh tests/integration/browser/sanity/game-initializes-with-arena-and-hud.test.ts --reporter=verbose` — navigates to the game, clicks Play, and asserts canvas, HUD, and asteroids.

### Logs

`logs/client.log` and `logs/server.log` (see `.cursor/rules/log-files.mdc`). Enable verbose client logs in `src/constants/index.ts` (`LOGGING.GLOBAL_LOG_LEVEL`, `DEBUG.ENABLED`), not via env vars.

### Quick verification checklist

```bash
npm run check:lint   # biome check — should pass cleanly
npm run check:ts     # tsc --noEmit — should pass cleanly
npm run test         # unit tests (~3s)
npm run build        # tsc && vite build — produces dist/
```

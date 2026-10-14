# Backlog reconciliation

Reviewed against `origin/main` at `b6526529` on 2026-09-30. This records the
decisions for the backlog's first PR; it does not close the remaining gameplay work.

Current frontend guidance supersedes the former stack exception: Astro manages
Vite and static documents; Svelte 5 and shadcn-svelte own DOM interfaces. Canvas2D
and shared TypeScript gameplay remain. Browser suites and their harness repair
requirements are retired; the commands and receipts below are historical evidence,
not instructions to restore them. See [agent operations](agent-operations.md).

## Keep the current module and rendering conventions

Keep relative imports and imports from defining modules, as required by
[AGENTS.md](../AGENTS.md). Client, server, shared rules, tests and build scripts
already use this convention. TypeScript has no path aliases to maintain across
those execution paths. No alias or barrel benchmark establishes a runtime or
maintenance benefit here. The [unused-code measurements](quality-benchmark.md)
show the value of checking exports directly, rather than adding re-export layers.

Keep Canvas2D. The [mobile implementation evidence](performance/mobile-implementation-status.md)
records measured improvements to the current renderer, collision work and
snapshot processing. A WebGL or renderer-library migration needs a sustained
device trace showing a remaining dominant rendering cost before its complexity
is justified. The historical desktop measurements do not prove phone frame rate,
thermal behavior or a performance ceiling. Physical-phone acceptance remains
unrun, as recorded in the [phone measurement plan](performance/phone-fps-measurement.md).

## Existing gameplay and operations

Health regeneration runs on the authoritative server using `SHIP.HEALTH_REGEN_*`: 2% of maximum health per second after five seconds without damage. Another hit restarts the delay, healing caps at maximum health, and client updates cannot clear the server timer. `tests/unit/server/health-regeneration.test.ts` guards these rules; the wire scenario below refers to its reviewed revision.

Surveying already reveals the shared exploration chart and records survey owner
IDs on nearby eligible rocks. A moving survey probe pulses from its host; a
nearby Hauler receives the probe and the Scout's survey attribution. This proves
shared nearby survey state, not a promise that every remote rock is broadcast.
Snapshots retain the documented world-interest limits.

Railway hosting and correlated client/server logs are already shipped repository
capabilities. [Deployment instructions](agent-operations.md#railway-game-server) require
successful Railway deployment verification independently of Vercel.
[Diagnostics](diagnostics.md) describes JSONL logs, browser forwarding, Railway
output and the player/session timeline reader. This reconciliation did not run a
fresh production deployment or inspect production logs.

## Fresh focused verification

Executed in this checkout on 2026-09-30:

- `npx --no-install vitest run tests/unit/server/health-regeneration.test.ts`:
  four tests passed, including delay, cap, repeated damage and client authority.
- `./scripts/test-runner.sh tests/integration/server/pilots-see-health-recover-after-an-asteroid-impact.test.ts tests/integration/browser/sanity/scout-launches-a-shared-moving-probe.test.ts --reporter=verbose`:
  three tests passed. The browser scenario used Scout and Hauler pages at desktop
  and touch viewports and checked the observer's shared probe/survey state.

The first unit attempt could not find installed Vitest. `npm ci` completed, then
the commands above passed. Touch emulation is not physical-phone evidence. The
full gate and release verification belong to the shipping step.

No player behavior or Wiki semantics changed, so no Wiki article update is
needed. The test-writing instructions are now consolidated in
`tests/AGENTS.md`, including the prohibition on browser tests.

## Named maintenance leftovers, 2026-10-14

This change prepares the named leftovers from Todoist task
[`6hjWGhqrx6rhMrrv`](https://app.todoist.com/app/task/6hjWGhqrx6rhMrrv).
It does not establish production acceptance or close release-dependent tasks.

| Item | Decision and retained contract |
| --- | --- |
| Fixture asteroid phenomena | Seed unmanaged fixtures once through `ensureAsteroidField`; keep managed regional seeding and make the seeding helper private. |
| Complete snapshot fields | Require the four always-emitted world fields in types and decoder; keep partial internal rounding for immutable cached spider data. |
| Spider boundaries | Require resource, resource-list, tow-release and nest-created callbacks; isolated scenarios supply explicit boundaries without extra resource scans. |
| Build identity | Derive the short display label from the validated full release identity; retain full provenance and opaque archive tokens. |
| Feedback audio | Keep all ten cue parameters unchanged in `AUDIO`; physical sound and haptic acceptance remains a separate human task. |
| Health response | Own the production builder in `server/health.ts`, derive status once, and expose the player count only as `world.players`; status-page and benchmark consumers use that field. |
| Unused Svelte files | Keep the existing Knip graph; a runner-owned contract proves an orphan fails, a live Astro import passes, and a comment-only mention fails. |
| Dead helpers | Remove `isReleaseId` and `RegionalAsteroidField.hasVisited`; keep the validated parser and the visited-sector set used by persistence work-count tests. |

Keep `shared/crewSpawn.ts`: the production join path calls `chooseCrewSpawn`.
Keep snapshot `isPaused`: the server benchmark reads it. Retiring a wire field
requires migrating its consumers and a client-first release; no internal pause
state is being removed.

Keep the owner-less burn normalizer until John's production count and retained
backup dates satisfy its existing task; [world operations](persistent-world.md)
records the older-backup restore caveat. Keep `deathCause` on the wire and
`findShipAsteroidOverlaps` until the explicit W2/W3 merged-and-live gate in
[task `6hjWGhm4rvX2f5pv`](https://app.todoist.com/app/task/6hjWGhm4rvX2f5pv)
is met. Co-op rescue also uses the server's internal death cause, which must
survive any later wire-only retirement.

Other rows of the original unverified sweep remain unverified planning data on
the existing Task40 and its linked Slop Plan. They are retained for a separately
selected follow-up, not certified as dead code or silently removed by this change.

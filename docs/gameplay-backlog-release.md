# Gameplay backlog draft release

This bundle is reviewable in a draft PR. It does not authorize production
activation, a Railway configuration change, or a merge.

## Deployment and verification

1. Land and verify the small-fixes bundle before this bundle. Its optional pickup
   receipt ID is compatible across independent client and server deployments:
   older clients ignore it, and the new client accepts receipts without it.
2. The opt-in [Railway preview](agent-operations.md#railway-preview) runs a matching
   client and authoritative server for pre-merge play. It uses the isolated
   preview environment; the shared slot currently hosts the most recently
   requested PR. A standalone Vercel preview against an older production server
   cannot exercise all new mechanics.
3. After the authorized merge, let Vercel and Railway publish independently from
   main. Charged-weapon commands require server acknowledgement, and new remains
   kinds require the client's capability offer, so either deployment arrival
   order is supported. Classify the actual base and merged trees with
   `scripts/server-release-inputs.mjs`; this bundle requires a server release.
4. Confirm both production Git deployments and a fresh canonical production
   smoke before continuing to the dependent cooperative bundle. Configuration,
   production data changes and campaign activation remain human-owned.

## Compatibility boundaries

Snapshot v3 and asteroid interactions remain required. There is no protocol
opt-out and no permissive DTO fallback.

The new client offers `worldRemains: 1` in its join. The existing per-socket
snapshot recipient includes `ship-remains` and `nest-remains` only when that
capability was offered; cached v3 clients receive the original map-asset kinds.
Malformed offers reject the join. A same-socket rejoin replaces the offer and
requests a fresh baseline while preserving outstanding transport debt.

The server acknowledges `chargedWeapons: 1` when it accepts start, release and
cancel commands. The client sends those commands only after its current join
acknowledgement advertises support, and clears support on disconnect. A current
client can therefore join an older server without emitting unknown commands.

Wildlife, bridges, salvage material, navigation/drafting timers, glowtoy metadata
and contour-riding metadata are additive optional fields. Current consumers
clear missing complete-snapshot state and preserve partial asteroid updates.
None bypasses the server's damage, motion, timer or persistence authority.

## Persistence and bounded work

Wildlife, remains, active weapon charges and bridges are transient. Remains retain
at most 128 records for ten minutes; active wildlife and bridges have fixed caps.
Snapshots filter new local entities by recipient position. Lighting queries
active spatial regions and processes a bounded number of glowtoys each step.

Glowtoy reveal state and contour-riding metadata use the existing asteroid JSON.
A cache reveal requests the next write-behind checkpoint so its reveal flag and
new persistent cargo commit in the same batch. It performs no disk operation in
the simulation frame. Existing saved asteroids without the optional fields stay
valid; the world generation is unchanged.

## Acceptance limits

Deterministic tests cover input cancellation, authoritative charge duration and
mining damage, material rewards, cache checkpointing, contour transfer and
lifetime limits, locality, strict decoding, and drawing calls. The draft must
also pass the complete repository gate and every required CI lane.

Brief desktop/mobile local browser checks cover the Wiki and ordinary flight,
steering, firing and light rendering. They do not certify physical two-finger
input, sustained charge-key release, subjective audio, cooperative play on a
server preview, or the reported Fire tablet frame rate. Linux-x64 CI owns Wiki
media reproducibility. The original Fire tablet and delayed-destruction reports
remain unresolved until their reported flows are reproduced.

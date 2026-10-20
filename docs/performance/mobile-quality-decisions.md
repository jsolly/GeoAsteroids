# Mobile graphics decisions

## Current production policy

Native device resolution and full glow remain enabled during ordinary desktop
and touch flight. `src/rendering/renderQuality.ts` owns those settings;
`src/rendering/canvasSurface.ts` applies their backing resolution. No global
flight-resolution or glow reduction has been accepted.

Low-end Mineral Scan uses a separate simplified view, selected by
`src/rendering/scanDetailPolicy.ts` for the known Fire model `KFTUWI` or a coarse
pointer with valid browser hints of at most 4 GB memory and four logical cores.
Other devices retain full Scan detail. `src/rendering/canvasSurface.ts` and
`src/rendering/simpleScanRenderer.ts` paint the simpler live scene directly into
the visible canvas at no more than DPR 0.75, one million backing pixels, and a
1536-pixel maximum dimension. Distant terrain is coarser; hazards, ships, shots,
navigation and controls remain live, and flight resolution returns afterward.
These presentation choices preserve physics, weapon timing, collisions, and
snapshot contents.

[PR #855](https://github.com/jsolly/GeoRoids/pull/855) shipped this Scan policy.
The [Fire tablet record](fire-tablet-experiments.md) preserves its short physical
Canvas test with glow off and the release receipt. John waived the longer test
as a shipping condition; sustained, thermal and full-glow acceptance remain
unqualified. An iPhone 16e is also available, but its OS/Safari version and
hands-on recordings remain pending. Desktop throttling does not establish
physical-device acceptance.

## Controlled comparisons

The following URL parameters are accepted only with `performance=1` or
`performance=collect`. They select a fixed setting for that diagnostic session;
they are not persistent player preferences or automatic adaptation.

| Parameter | Values | Effect |
| --- | --- | --- |
| `renderDpr` | `native`, `2`, `1.5`, `1`, `0.75` | Cap flight backing resolution; never upscale a lower-DPR screen |
| `renderGlow` | `full`, `off` | Retain or suppress cosmetic canvas shadow blur |
| `scanDetail` | `auto`, `full`, `simple` | Use device policy or force Scan detail for that visit |

For example, `/?performance=collect&renderDpr=2&renderGlow=full` compares DPR 2
while retaining glow. First compare resolution and glow independently. Then
compare combinations of successful settings. All touch coordinates, viewport
geometry and camera projection remain in CSS pixels.

On a native-DPR-1.5 tablet, caps 2 and 1.5 do not reduce the flight backing store.
Use cap 1 for the first flight-resolution comparison; cap 0.75 is a softer
diagnostic candidate. Simplified Scan keeps its separate DPR and backing-size
limits, so a flight cap of 1 does not reduce it further. See the
[Fire tablet record](fire-tablet-experiments.md).

| Candidate | Visible tradeoff | Status and removal comparison |
| --- | --- | --- |
| DPR cap 2 | Softer thin lines and text on higher-density screens | Experiment only; compare native resolution |
| DPR cap 1.5 | Greater softness, particularly distant projectiles and text | Experiment only; compare DPR 2 and native |
| Flight DPR cap 1 | Softer canvas text and thin lines on DPR-1.5 tablets | Experiment only; compare native flight at the same glow |
| Flight DPR cap 0.75 | Noticeable softness below CSS-pixel resolution | Experiment only; compare cap 1 and inspect distant hazards |
| Glow off | Less luminous hulls, projectiles, scan pulses and effects | Experiment only; compare full glow at the same DPR |

No measured performance improvement is claimed by the presence of these controls.
The numerical target is sustained 60 Hz presentation on supported physical devices,
with fewer than 1% gameplay intervals above 25 ms and p99 at or below 33.3 ms.
Handler-to-render p95 must remain below 33.3 ms with at least 300 distinct inputs.
Client frame CPU p95 must remain below 10 ms; compare CPU and input regressions
against the A/A noise alongside frame pacing.
These are scheduling/submission measures, not GPU presentation guarantees.

## Accepting and retiring a reduction

Every future accepted cap, glow reduction, render cadence limit or slower HUD
refresh needs its own entry here before changing the production preset. Record
any owner-approved exception separately from completed measurements, as with
the shipped Scan policy above. For qualification, record:

- Exact setting, activation rule, owning source and accepted release.
- Actual phone models, OS/browser versions, refresh and power conditions.
- Baseline/candidate source and harness hashes, raw report paths and checksums.
- Per-session A/A variation and paired effects, including failed/incomplete runs.
- Visual captures and the specific loss of sharpness, glow or responsiveness.
- Five-minute paired measurements and fifteen-minute sustained acceptance on the
  affected device cohorts, plus minimally instrumented checks.
- The higher-quality control and the passing test that will remove the reduction.

For a future flight reduction, choose one fixed touch preset, preferring the
highest passing DPR, then full glow at that DPR. Native/full wins whenever it
meets the target. Treat these numerical targets as review references, not CI gates. Change them
explicitly when feature costs or supported-device expectations justify it, and
record the reason and evidence. Do not infer Android acceptance from an iPhone result.

Retest each reduction against its higher-quality control after a general
performance improvement or a supported-device change. Remove or relax it when
the higher-quality version passes the same paired and sustained checks on both
supported cohorts. A faster new phone alone does not retire protection for an
older phone that remains supported. Delete obsolete branches, migrate tests,
update the Wiki and source review, and record the retirement evidence here.

## Current minimap policy

The minimap shows the local ship and other players, plus compact marks
for live asteroids, loot drops, loose Earth-observation satellite pickups, and
orbiting pickups. Marks use current entity positions, skip dead or exploding
objects, and disappear when authoritative state removes a collected or expired
object. World marks are batched by category and pilots remain on top. This policy
is part of the product HUD and is independent of the temporary DPR and glow
experiments above.

The player-only minimap comparison in
[minimap-work-results.md](minimap-work-results.md) is retained as historical
evidence from an earlier candidate. Its lower work counts do not define the
current product policy or establish a frame-rate improvement.

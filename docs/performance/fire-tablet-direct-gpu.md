# Fire tablet direct GPU experiment

## Status

Sustained 60 FPS on the Fire HD 10, 13th generation, is the acceptance target.
Initial Fire recordings measured 57.8 flight FPS with Canvas and 28.9 with direct
GPU at native DPR 1.5, glow off, and full Scan detail. These short, unequal runs
show a regression worth isolating; they do not establish sustained performance
or thermal behavior. Soft-keyboard behavior remains unverified. Canvas stays the
default renderer. The existing copied
`?renderer=webgl2` experiment remains available with its native rear painter.

Use `?renderer=webgl2-direct` to test direct GPU rear composition. It renders
background, stars, and full-width terrain contours on a visible WebGL2 canvas
behind a transparent Canvas foreground. Hairline terrain stays on its original
native painter. Ships, hazards, projectiles, lighting, radar, and HUD keep their
existing painters, geometry, order, and game clocks.

On recognized low-end devices, automatic simplified Scan keeps its bounded Canvas
overview. The direct GPU rear is hidden during that view and resumes after the
first successful detailed flight frame; retained geometry is reused. Reports keep
actual Canvas and direct GPU frame counts, and distinguish intentional Scan frames
from an unavailable or failed GPU.

For the diagnostic comparison below, use automatic Scan detail in every arm.
On the Fire, simplified Scan uses Canvas in all three arms, so compare flight
and Scan timings separately. Strict renderer benchmarks still reject fallback
frames.

## Fire diagnostic matrix

Keep the same browser, orientation, native DPR, glow off, power state, and scene.
Use these query strings on the preview's `/debug` route:

| Arm | Query | Flight rear painter |
| --- | --- | --- |
| A | `?performance=collect&renderer=canvas&renderDpr=native&renderGlow=off&scanDetail=auto&gpuContours=auto` | Standard Canvas |
| B | `?performance=collect&renderer=webgl2-direct&renderDpr=native&renderGlow=off&scanDetail=auto&gpuContours=auto` | Current GPU stars and terrain, native hairlines |
| C | `?performance=collect&renderer=webgl2-direct&renderDpr=native&renderGlow=off&scanDetail=auto&gpuContours=canvas` | GPU background and stars, native Canvas terrain at every width |

Run A, B, then C. For each arm, enter the game and warm up for 30
seconds, choose **Start**, then fly normally for 90 seconds while steering and
firing. Trigger three Scans, letting each return fully to normal flight. Choose
**Stop**, then send a report labeled with the arm and run order before reloading
for the next arm. Download the recording before starting another collection if
you need the raw samples.

Reporting permits three submissions per client address per hour and 30 globally
per UTC day. Reserve the three available submissions for the tablet runs. If a
quota blocks a report, retain that stopped recording and wait for submission to
be available; do not replay completed gameplay or start the next collection.

Compare `play.flightFrameIntervalMs` separately from `play.scanFrameIntervalMs`
and its enter, wide, and return stages. Whole-run FPS blends different painters.
B versus C screens the terrain-policy difference, while A versus C compares the
complete direct rear package. A single run per arm leaves scene, order, and
thermal drift uncontrolled. Close rankings or different conditions are
inconclusive; request a matched repeat in a later reporting window if needed.
This sequence screens candidates rather than proving a precise cause or sustained
performance.

`gpuContours=canvas` is honored only with `performance=1` or
`performance=collect`; otherwise selection stays `auto`. Reports retain the
selected arm in graphics settings. `gpuNativeContourFrames` and
`gpuCapsuleContourFrames` count successful GPU compositions by the terrain
painter chosen that frame, including empty terrain. Failed compositions and
Canvas Simple Scan frames increment neither counter. Arm C retains the same two
surfaces and GPU stars as B and adds no rear upload or blit; mask allocation is
unchanged.

## Architectural choice

| Candidate | Work removed | Tradeoff |
| --- | --- | --- |
| Direct GPU rear with retained star tiles and contours | Native star rectangle painting, full native rear upload, and GPU-to-Canvas rear copy | A transparent foreground adds browser layer composition; star edges and translucent blending can differ from the opaque renderer. |
| Native rear canvas, GPU terrain canvas, transparent foreground canvas | Full native rear upload and GPU-to-Canvas rear copy | Retains native star painting and adds a third full-size surface plus browser composition. |

The direct candidate removes more work with two surfaces. The native-rear
alternative retains another whole-screen surface to preserve star rasterization,
while still introducing the foreground blending boundary. That extra surface is
not justified for this opt-in experiment.

The older GPU project deliberately chose an opaque copied canvas after a
transparent overlay failed its frozen pixel-parity bar. See the historical
[GPU renderer plan](gpu-renderer-plan.md#measured-architecture-correction-1209-utc).
This experiment does not satisfy or replace that parity claim. It permits
cosmetic star-edge and translucent-color differences, requires readable terrain,
ships, projectiles, and touch controls, and keeps the standard renderer one reload
away. It is a separate candidate for physical-device comparison.

At the reported 1200 by 1641 backing size, a copied rear uploads 7,876,800 source
bytes and performs one full-size Canvas blit each frame. Direct composition does
neither operation. It still clears the transparent foreground and draws the GPU
rear; the browser still composites both surfaces. Removing explicit transfers
alone does not prove a frame-rate improvement.

## Measurement and failure boundaries

The renderer reports `webgl2-direct` independently from `canvas` and `webgl2`.
Per-frame GPU observations require retained star submissions, exactly one direct
composition, the exclusive native/GPU contour painter, zero rear uploads, and zero
rear blits. The manual fixture captures both layers together outside timing.
Frozen comparisons preserve requested and observed backend identity.

Star and contour buffers retain only local immutable arrays used by the current
frame. Camera motion changes uniforms; it does not upload unchanged geometry.
Context loss hides the rear canvas and returns the next frame to complete opaque
Canvas painting. Restoration builds new GPU objects. Allocation, drawing, and
composition failures retire owned resources. Resize keeps CSS and backing sizes
aligned, and disposal removes the extra canvas and its listeners.

Run unprofiled comparisons with matching dimensions, DPR, glow, browser, scene,
power state, and foreground duration. Use the existing
[measurement runbook](mobile-measurement-runbook.md) and
[benchmark guide](../../benchmarks/README.md); keep timing isolated from builds,
tests, and other workloads. Follow the A/B/C matrix above before changing DPR or
combining other controls. Raw work reduction and a short host screening are
preliminary evidence. Physical Fire tablet acceptance
requires sustained gameplay with readable cues at the required 60 Hz cadence.

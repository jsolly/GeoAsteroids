# Fire tablet direct GPU experiment

## Status

Sustained 60 FPS on the Fire HD 10, 13th generation, is the acceptance target.
Physical tablet performance, thermal behavior, and soft-keyboard behavior remain
unverified. Canvas stays the default renderer. The existing copied
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

For an isolated GPU comparison, pin `scanDetail=full` on both Canvas and direct
GPU links. An automatic simplified Scan run measures hybrid gameplay, not GPU
acceleration of its overview. Strict renderer benchmarks still reject fallback
frames.

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
tests, and other workloads. Compare native Canvas, copied WebGL2, and direct
WebGL2 before combining lower DPR or glow-off controls. Raw work reduction and a
short host screening are preliminary evidence. Physical Fire tablet acceptance
requires sustained gameplay with readable cues at the required 60 Hz cadence.

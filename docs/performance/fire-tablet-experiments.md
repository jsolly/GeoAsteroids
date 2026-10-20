# Fire HD 10 measurement record

The target remains sustained 60 FPS on the Fire HD 10, 13th generation.
GPU work in PR #854 remains paused.

## Historical capture

The reported release `7c30592ef940793e7d717115df5f8bbdc6f3bf4e` capture used a
`KFTUWI` tablet, Chrome 152 on Android 11, an 800 by 1094 CSS viewport, native
DPR 1.5, a 1200 by 1641 backing canvas, and full glow. Its old HUD estimate was
8 FPS. The 138 cached asteroids did not establish the visible draw count, and
the 8 ms snapshot age measured time since local application, not server-to-screen
delay. A single capture does not identify the bottleneck.

The revised HUD counts frames over bounded elapsed foreground time, including
long stalls, instead of smoothing reciprocal intervals and dropping stalls over
250 ms. Use recorder exports for comparisons rather than one HUD number.

## Shipped Scan behavior

[PR #855](https://github.com/jsolly/GeoRoids/pull/855) shipped direct simplified
Scan rendering at `63fd9f754c072ae4cbf956448c83a8b8471dce97`. Low-end device
policy selects the simpler view, which paints live terrain, ships, hazards and
navigation into the bounded visible canvas and restores flight resolution
afterward. Scan uses at most DPR 0.75, one million backing pixels, and a
1536-pixel maximum dimension. The [quality policy](mobile-quality-decisions.md)
defines activation and diagnostic controls.

## Short physical-device result

A complete 53.0549-second Fire recording on the reviewed PR #855 preview measured
about 59.1 FPS in flight and 59.1 FPS across 8.482 seconds of Scan intervals,
including entry, wide view and return. It used Canvas, native-resolution flight
at 1200 by 1641, simplified Scan at 600 by 820, and the diagnostic glow-off
setting. This result does not qualify ordinary full-glow play.

Report `735d2e33-a926-4fe6-93e1-9db500ec4530` contains 3,135 completed frame
intervals, including 501 Scan intervals. Its reconstructed report SHA-256 is
`f92a64697076c16e3f9ffea6d8cd955e3761f91666ed12ef51af8834086e81ce`.
The preview head was `a8a6f60ae979ce5972a91ed2a506644ef645509d`; its runtime
release token was `b0003527e3fe57a90ec7665faa1038af4e13639b`.
The [production receipt](https://github.com/jsolly/GeoRoids/pull/855#issuecomment-6302251345)
records the release separately from the measurement limits.

The run was short and exploratory, with occasional slow intervals. The uploaded
bundle contains summary percentiles rather than the original full interval
series; unmatched manual scenes cannot establish a controlled causal speedup.
Sustained, thermal, battery, full-glow and GPU performance remain unqualified.
John waived the longer test as a shipping condition; it was not performed or
passed.

## Optional future comparisons

For any future authorized device comparison, follow the
[measurement runbook](mobile-measurement-runbook.md). Caps 2 and 1.5 do not lower
flight resolution on this native-DPR-1.5 tablet; cap 1 can isolate flight pixel
cost. Compare resolution and glow independently, and record Scan mode and actual
backing dimensions separately. These are optional experiments, not an active
testing handoff or a restart of the paused GPU work.

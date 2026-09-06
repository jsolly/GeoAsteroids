# GeoRoids — ships and factions (topology hold)

Art-box replica of AD v2 **topology only**. Player kit hulls are **not baked**
until John / Product Owner set `AD_V2_HULL_BAKE_LOCKED` in `src/entities/ship/shipKits.ts`.

Stroke `#5EEAD4` on `#000011`. Play-scale target ~32px. Matt-blush outline Asteroids.

## Kits (after lock)

| Kit | Topology | Sheet note |
| --- | --- | --- |
| Dart | needle | Tall thin isosceles; inverted-V notch at aft |
| Hauler | barge hex | Wide low polygon; flat keel; faceted bow |
| Warden | Δ + forward shield arc | Delta hull; detached arc above the apex |
| Skirmisher | Y-fork | Two forward prongs; pointed aft |
| Quake | terraced mountain | Stepped tiers; triangular peak |

Do not invent competing faction-mark art. Soft factions stay on the factions stream.

## Saucer NPC (separate language)

Higher-fidelity SVG-ish. Not player line-ship DNA. Ambient, not a faction mark.

- Hull `#C4B5FD`, shot `#E9D5FF`
- Outer + inner flattened ellipses
- 8 perpendicular ticks on the outer ring
- Cabin oval with fill opacity 0.18
- Vertical antenna capped with an empty dish circle
- Firing: short segment off the outer ring

See `src/entities/npc/saucerRenderHook.ts`.

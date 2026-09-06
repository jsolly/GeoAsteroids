# GeoRoids — ships and factions (topology hold)

Art-box replica of AD v2 **topology only**. Player kit hulls are **not baked**
until John / Product Owner set `AD_V2_HULL_BAKE_LOCKED` in `src/entities/ship/shipKits.ts`.

Stroke `#5EEAD4` on `#000011`. Play-scale target ~32px. Matt-blush outline Asteroids.

## Kits (John lock — exactly five)

There is **no Hook sixth ship class**. Harpoon is a **Hauler-only** ability.

| Kit | Topology (after hull lock) | Ability |
| --- | --- | --- |
| Dart | needle — tall thin isosceles; inverted-V notch at aft | Boost dash |
| Hauler | barge hex — wide low polygon; flat keel; faceted bow | **Harpoon** (tether / latch) |
| Warden | Δ + forward shield arc — detached arc above the apex | Shield |
| Skirmisher | Y-fork — two forward prongs; pointed aft | Burst fire |
| Quake | terraced mountain — stepped tiers; triangular peak | Shock pulse |

Do not invent competing faction-mark art. Soft factions stay on the factions stream (#465).

## Harpoon (Hauler only)

John lock via Game Director. Mechanics and VFX may ship now; hull bake stays on hold.

- Only the Hauler kit may activate or draw harpoon
- Latch one nearby rock (forward hemisphere preferred, else nearest in range)
- While latched, haul that rock toward the Hauler
- Tether line + latch ring VFX on Hauler only — never on Dart / Warden / Skirmisher / Quake
- Not a shared all-kit hook, and not a sixth class

See `src/entities/ship/shipAbilities.ts` and `drawHaulerHarpoonVfx`.

## Saucer NPC (separate language)

Higher-fidelity SVG-ish. Not player line-ship DNA. Ambient, not a faction mark.
AD confirmed these box paths — canvas drawer replicates them.

| State | Path |
| --- | --- |
| Idle | `georoids-art/saucer-npc.svg` |
| Firing | `georoids-art/saucer-npc-firing.svg` |
| Preview | `georoids-art/saucer-silhouette-svgish.png` |

- Hull `#C4B5FD`, shot `#E9D5FF`
- Outer + inner flattened ellipses
- 8 perpendicular ticks on the outer ring
- Cabin oval with fill opacity 0.18
- Vertical antenna capped with an empty dish circle
- Firing: short `#E9D5FF` segments off both rims

See `src/entities/npc/saucerRenderHook.ts`. Independent of kit hull lock.

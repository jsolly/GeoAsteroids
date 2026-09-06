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

Soft factions stay on the factions stream (#465). Names stay **ION** / **EMBER**.
Art is tiny marks only via `FACTION_MARK_PAINTERS`:

| Side | Mark | Stroke |
| --- | --- | --- |
| ION | chevron | `#A8A0C8` |
| EMBER | diamond | `#D4B896` |

Never paint full hulls with `#5EEAD4` or `#FB923C` — those are local/bot ownership
only. Hull stroke stays local / remote / bot.

## Harpoon (Hauler only)

John lock via Game Director. This **is** the Hauler ability — latch, haul, and
tether VFX. It is not a sixth class and not “VFX-only until Hook.”

- Only the Hauler kit may activate or draw harpoon
- Latch one nearby rock (forward hemisphere preferred, else nearest in range)
- While latched, haul that rock toward the Hauler
- Tether line + latch ring VFX on Hauler only — never on Dart / Warden / Skirmisher / Quake

See `src/entities/ship/shipAbilities.ts` and `drawHaulerHarpoonVfx`.
Hull bake stays on hold until silhouette v2 lock.

## Saucer NPC (separate language)

Ambient NPC. Not player line-ship DNA. Not a faction mark.

The current UFO-disc is **TEMPORARY** (John rejected it). Game Director will
deliver a Landsat-style satellite. Swap art with
`registerSaucerNpcPainter` + `setSaucerNpcArtId('landsat')` — do not grow the disc.

Temporary disc files (box paths, do not polish):

| State | Path |
| --- | --- |
| Idle | `georoids-art/saucer-npc.svg` |
| Firing | `georoids-art/saucer-npc-firing.svg` |
| Preview | `georoids-art/saucer-silhouette-svgish.png` |

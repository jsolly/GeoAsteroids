import { GLOWTOY, type ShipLight, shipIlluminates } from '../../shared/glowtoy';
import type { AsteroidData, Position } from '../../shared-types';

/** All state belongs to the persistent rock; the manager retains no history. */
export function advanceGlowtoys(
  rocks: readonly AsteroidData[],
  lights: readonly ShipLight[],
  reveal: (position: Position) => void
): Position[] {
  const bright: Position[] = [];
  let count = 0;
  for (const rock of rocks) {
    const glow = rock.glowtoy;
    if (!glow) {
      continue;
    }
    if (count++ >= GLOWTOY.maximumActive) {
      break;
    }
    glow.charge = Math.max(
      0,
      Math.min(
        1,
        glow.charge +
          (lights.some((light) => shipIlluminates(light, rock.position))
            ? GLOWTOY.chargePerTick
            : -GLOWTOY.decayPerTick)
      )
    );
    if (glow.charge < 0.7) {
      continue;
    }
    bright.push({ ...rock.position });
    if (
      !glow.cacheRevealed &&
      Math.hypot(rock.position.x - glow.cachePosition.x, rock.position.y - glow.cachePosition.y) <=
        GLOWTOY.revealRadius
    ) {
      glow.cacheRevealed = true;
      reveal(glow.cachePosition);
    }
  }
  return bright;
}

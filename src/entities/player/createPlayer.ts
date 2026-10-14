import type { Position, ShipKitId } from '../../../shared-types';
import { resolveSpawnPosition } from '../../utils/spawnPosition';
import type { ShipCombatNetwork } from '../ship/shipCombatNetwork';
import { Player } from './Player';

export function createPlayer(config: {
  id?: string;
  name: string;
  type: 'local' | 'remote';
  position?: Position;
  color?: string;
  kitId?: ShipKitId;
  combatNetwork?: ShipCombatNetwork;
}): Player {
  const player = new Player({
    id: config.id ?? crypto.randomUUID(),
    name: config.name,
    type: config.type,
    ...(config.combatNetwork !== undefined ? { combatNetwork: config.combatNetwork } : {}),
    ...(config.kitId !== undefined ? { kitId: config.kitId } : {}),
  });
  player.ship.position = resolveSpawnPosition(config.position);
  if (config.color != null && config.color !== '') {
    player.color = config.color;
    player.ship.color = config.color;
  }
  return player;
}

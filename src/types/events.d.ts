import type { SatellitePickupCollected } from '../../shared-types';
import type { PlayerIdentityChangedDetail } from '../network/services/playerIdentityEvents';

declare global {
  interface WindowEventMap {
    gameStart: CustomEvent<undefined>;
    playViewOn: CustomEvent<undefined>;
    playViewOff: CustomEvent<undefined>;
    playerIdentityChanged: CustomEvent<PlayerIdentityChangedDetail>;
    satellitePickupCollected: CustomEvent<SatellitePickupCollected>;
  }
}

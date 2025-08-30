import { EMP_PULSE_RADIUS } from '../../constants/game';
import { PlayerNetwork } from '../../entities/player/playerNetwork';
import type { Roid, RoidBelt } from '../../entities/roid/Roid';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';

export class EMPPulseService {
  private static instance: EMPPulseService;
  private multiplayerManager: MultiplayerManager;
  private playerNetwork: PlayerNetwork | null = null;

  private constructor() {
    this.multiplayerManager = MultiplayerManager.getInstance();

    this.setupEmpPulseHandler();
  }

  private getPlayerNetwork(): PlayerNetwork {
    if (!this.playerNetwork) {
      this.playerNetwork = PlayerNetwork.getInstance();
    }
    return this.playerNetwork;
  }

  static getInstance(): EMPPulseService {
    if (!EMPPulseService.instance) {
      EMPPulseService.instance = new EMPPulseService();
    }
    return EMPPulseService.instance;
  }

  private setupEmpPulseHandler(): void {
    window.addEventListener('empPulse', (event: Event) => {
      const empEvent = event as CustomEvent<{
        shipPosition: { x: number; y: number };
        shipRadius: number;
      }>;
      this.handleEmpPulse(empEvent.detail);
    });
  }

  private handleEmpPulse(_detail: {
    shipPosition: { x: number; y: number };
    shipRadius: number;
  }): void {
    // Handle EMP effects on game objects
    // This will be called when any ship activates EMP pulse
  }

  destroyRoidsInRadius(
    center: { x: number; y: number },
    radius: number,
    roidBelt: RoidBelt,
    scoreCallback: (points: number) => void
  ): void {
    const roids = roidBelt.roids;
    const roidsToDestroy: number[] = [];
    const newRoidsToAdd: Roid[] = [];

    // First pass: collect indices and calculate destruction results
    for (let i = roids.length - 1; i >= 0; i--) {
      const roid = roids[i];
      if (!roid) {
        continue; // Skip if roid is already removed
      }

      const distance = Math.sqrt(
        (roid.position.x - center.x) ** 2 + (roid.position.y - center.y) ** 2
      );

      if (distance <= radius) {
        const result = roidBelt.destroyRoid(i);
        scoreCallback(result.score);
        roidsToDestroy.push(i);
        newRoidsToAdd.push(...result.newRoids);
      }
    }

    // Second pass: remove destroyed roids in descending order to maintain valid indices
    roidsToDestroy.sort((a, b) => b - a);
    for (const index of roidsToDestroy) {
      if (index >= 0 && index < roidBelt.roids.length) {
        roidBelt.roids.splice(index, 1);
      }
    }

    // Add new roids from destruction
    roidBelt.roids.push(...newRoidsToAdd);
  }

  destroyBotsInRadius(
    center: { x: number; y: number },
    radius: number,
    scoreCallback: (points: number) => void
  ): void {
    const bots = this.getPlayerNetwork().getBotPlayers();
    const botsToDestroy: string[] = [];

    for (const bot of bots) {
      const distance = Math.sqrt(
        (bot.ship.position.x - center.x) ** 2 + (bot.ship.position.y - center.y) ** 2
      );

      if (distance <= radius) {
        botsToDestroy.push(bot.id);
      }
    }

    // Destroy all detected bots
    for (const botId of botsToDestroy) {
      this.multiplayerManager.empDestroyPlayer(botId);
      scoreCallback(200); // Points for destroying a bot with EMP
    }
  }

  triggerEmpPulse(
    center: { x: number; y: number },
    roidBelt: RoidBelt,
    scoreCallback: (points: number) => void
  ): void {
    this.destroyRoidsInRadius(center, EMP_PULSE_RADIUS, roidBelt, scoreCallback);
    this.destroyBotsInRadius(center, EMP_PULSE_RADIUS, scoreCallback);
  }
}

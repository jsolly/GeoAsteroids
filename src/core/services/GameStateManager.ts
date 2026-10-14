import { logger } from '../../utils/Logger';

export class GameStateManager {
  private static instance: GameStateManager;
  private isGameRunning = false;

  private pickupMessage = '';
  private pickupMessageTimer = 0;
  private readonly PICKUP_MESSAGE_DURATION_FRAMES = 120;

  private constructor() {}

  static getInstance(): GameStateManager {
    if (GameStateManager.instance == null) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  getIsGameRunning(): boolean {
    return this.isGameRunning;
  }

  setIsGameRunning(running: boolean): void {
    this.isGameRunning = running;
    logger.debug('GAME_STATE', 'Game running state set', { isGameRunning: running });
  }

  setPickupMessage(pickupName: string): void {
    this.pickupMessage = `${pickupName} acquired`;
    this.pickupMessageTimer = this.PICKUP_MESSAGE_DURATION_FRAMES;
  }

  setDeliveryMessage(points: number, collaborators: number): void {
    this.pickupMessage =
      collaborators > 1 ? `Team delivery +${points} each` : `Delivery +${points}`;
    this.pickupMessageTimer = this.PICKUP_MESSAGE_DURATION_FRAMES;
  }

  setNotice(message: string): void {
    this.pickupMessage = message;
    this.pickupMessageTimer = this.PICKUP_MESSAGE_DURATION_FRAMES;
  }

  clearPickupMessage(): void {
    this.pickupMessage = '';
    this.pickupMessageTimer = 0;
  }

  getPickupMessage(): string {
    return this.pickupMessage;
  }

  hasPickupMessage(): boolean {
    return this.pickupMessageTimer > 0;
  }

  updatePickupMessageTimer(): void {
    if (this.pickupMessageTimer > 0) {
      this.pickupMessageTimer--;
      if (this.pickupMessageTimer <= 0) {
        this.pickupMessage = '';
      }
    }
  }
}

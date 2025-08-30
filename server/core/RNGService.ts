// Mulberry32 seeded PRNG for deterministic asteroid/bot generation
export class RNGService {
  private rngState: number;
  private initialSeed: number;

  constructor(serverSeed?: number) {
    // Store the initial seed for reset functionality
    this.initialSeed = (serverSeed ?? 0x9E3779B9) >>> 0; // Default seed, normalized to unsigned 32-bit
    this.rngState = this.initialSeed;
  }

  // Seeded random number generator (mulberry32)
  public random(): number {
    this.rngState = (this.rngState + 0x6D2B79F5) >>> 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Reset RNG to initial state for reproducible generation
  public reset(): void {
    this.rngState = this.initialSeed;
  }

  // Get random position within bounds
  public randomPosition(bounds: { width: number; height: number }): { x: number; y: number } {
    return {
      x: this.random() * bounds.width - bounds.width / 2,
      y: this.random() * bounds.height - bounds.height / 2,
    };
  }

  // Get random velocity
  public randomVelocity(maxSpeed: number): { x: number; y: number } {
    return {
      x: (this.random() - 0.5) * maxSpeed,
      y: (this.random() - 0.5) * maxSpeed,
    };
  }

  // Get current RNG state
  public getState(): number {
    return this.rngState;
  }

  // Set RNG state
  public setState(state: number): void {
    this.rngState = state >>> 0; // Ensure unsigned 32-bit
  }

  // Set a new seed and reset the generator
  public setSeed(seed: number): void {
    this.initialSeed = seed >>> 0; // Normalize to unsigned 32-bit
    this.rngState = this.initialSeed;
  }

  // Create a new RNGService instance with the provided seed or derived from current state
  public fork(seed?: number): RNGService {
    const newSeed = seed !== undefined ? seed : this.random() * 0xFFFFFFFF;
    return new RNGService(newSeed >>> 0);
  }
}

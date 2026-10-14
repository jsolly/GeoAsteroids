/** Charge is measured by authoritative simulation frames, never a client duration. */
export const CHARGED_WEAPON = {
  minimumFrames: 9,
  fullFrames: 90,
  expiryFrames: 600,
  cooldownFrames: 180,
  maximumEnergy: 4,
} as const;

export function chargedWeaponEnergy(frames: number): number {
  return (
    1 +
    (CHARGED_WEAPON.maximumEnergy - 1) *
      Math.min(1, Math.max(0, frames) / CHARGED_WEAPON.fullFrames)
  );
}

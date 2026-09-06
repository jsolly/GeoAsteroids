import type { FuelDropData, Position } from '../shared-types';
import { FUEL } from '../src/constants';

/** Shared tank shape for player and bot ships (client Ship + server GameEntity). */
export interface FuelTank {
  fuel: number;
  maxFuel: number;
}

export function createFuelTank(start: number = FUEL.START, max: number = FUEL.MAX): FuelTank {
  return {
    fuel: Math.min(max, Math.max(0, start)),
    maxFuel: max,
  };
}

export function shouldReleaseFuel(asteroidSize: number): boolean {
  return asteroidSize >= FUEL.MIN_ROID_SIZE_TO_DROP;
}

export function calculateFuelAfterPickup(
  currentFuel: number,
  amount: number,
  maxFuel: number
): number {
  return Math.min(maxFuel, Math.max(0, currentFuel + amount));
}

export function calculateFuelAfterSpend(currentFuel: number, amount: number): number {
  return Math.max(0, currentFuel - amount);
}

export function canAffordFuelCost(currentFuel: number, cost: number): boolean {
  return currentFuel >= cost;
}

export function applyFuelPickup(tank: FuelTank, amount: number): number {
  tank.fuel = calculateFuelAfterPickup(tank.fuel, amount, tank.maxFuel);
  return tank.fuel;
}

export function trySpendEmpFuel(tank: FuelTank, cost: number = FUEL.EMP_COST): boolean {
  if (!canAffordFuelCost(tank.fuel, cost)) {
    return false;
  }
  tank.fuel = calculateFuelAfterSpend(tank.fuel, cost);
  return true;
}

export function createFuelDropData(
  id: string,
  position: Position,
  amount: number = FUEL.DROP_AMOUNT
): FuelDropData {
  return {
    id,
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    amount,
    radius: FUEL.DROP_RADIUS,
  };
}

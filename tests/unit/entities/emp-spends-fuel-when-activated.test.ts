import { beforeEach, describe, expect, test } from 'vitest';
import { FUEL } from '../../../src/constants';
import { Ship } from '../../../src/entities/ship/Ship';
import { canAffordFuelCost, trySpendEmpFuel, type FuelTank } from '../../../shared/fuel';

describe('EMP spends fuel when activated', () => {
  let ship: Ship;

  beforeEach(() => {
    ship = new Ship({ position: { x: 100, y: 100 } });
    ship.exploding = false;
    ship.empPulseActive = false;
  });

  test('player and bot ships start with the same tank', () => {
    const bot = new Ship({ position: { x: 0, y: 0 }, isBot: true });
    expect(ship.fuel).toBe(FUEL.START);
    expect(bot.fuel).toBe(FUEL.START);
    expect(ship.maxFuel).toBe(FUEL.MAX);
    expect(bot.maxFuel).toBe(FUEL.MAX);
  });

  test('activating EMP spends fuel and arms the pulse', () => {
    const fired = ship.empPulse();

    expect(fired).toBe(true);
    expect(ship.empPulseActive).toBe(true);
    expect(ship.fuel).toBe(FUEL.START - FUEL.EMP_COST);
  });

  test('EMP does nothing when the tank cannot cover the cost', () => {
    ship.fuel = FUEL.EMP_COST - 1;

    const fired = ship.empPulse();

    expect(fired).toBe(false);
    expect(ship.empPulseActive).toBe(false);
    expect(ship.fuel).toBe(FUEL.EMP_COST - 1);
  });

  test('a second EMP is refused while the pulse is already active', () => {
    expect(ship.empPulse()).toBe(true);
    const fuelAfterFirst = ship.fuel;

    expect(ship.empPulse()).toBe(false);
    expect(ship.fuel).toBe(fuelAfterFirst);
  });

  test('shared spend helper is what player and bot tanks use', () => {
    const tank: FuelTank = { fuel: FUEL.START, maxFuel: FUEL.MAX };
    expect(canAffordFuelCost(tank.fuel, FUEL.EMP_COST)).toBe(true);
    expect(trySpendEmpFuel(tank)).toBe(true);
    expect(tank.fuel).toBe(FUEL.START - FUEL.EMP_COST);
    tank.fuel = 0;
    expect(trySpendEmpFuel(tank)).toBe(false);
  });
});

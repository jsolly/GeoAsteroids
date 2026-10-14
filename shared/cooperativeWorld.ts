import type { CooperativeRecord } from '../shared-types';
import { COOPERATIVE } from './cooperativeRules';
import { frontierSite } from './frontier';
import { civicLot, TOWN_HEARTH } from './furnaces';
import { WORLD } from './world';

function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function deadline(value: unknown): boolean {
  return value === null || integer(value);
}
function position(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'x' in value &&
    'y' in value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Math.hypot(value.x, value.y) <= WORLD.radius
  );
}

/** SQLite and worker input are untrusted. Invalid progress must stop loading, never reset it. */
export function validCooperativeRecord(value: unknown): value is CooperativeRecord {
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 128
  ) {
    return false;
  }
  switch (value.kind) {
    case 'supply':
      return (
        (value.id === TOWN_HEARTH.id || Boolean(civicLot(value.id) ?? frontierSite(value.id))) &&
        'availableValue' in value &&
        integer(value.availableValue) &&
        'nextShipment' in value &&
        integer(value.nextShipment)
      );
    case 'project':
      return (
        value.id === 'deep-scanner' &&
        'deliveredValue' in value &&
        integer(value.deliveredValue, COOPERATIVE.scannerValue) &&
        'completedAt' in value &&
        deadline(value.completedAt) &&
        (value.completedAt !== null) === (value.deliveredValue === COOPERATIVE.scannerValue)
      );
    case 'downed':
      return (
        'position' in value &&
        position(value.position) &&
        'deadline' in value &&
        integer(value.deadline) &&
        'cause' in value &&
        typeof value.cause === 'string' &&
        value.cause.length <= 128
      );
    case 'hive': {
      const site = frontierSite(value.id);
      if (!site) {
        return false;
      }
      if (
        !('position' in value) ||
        !position(value.position) ||
        !value.position ||
        typeof value.position !== 'object' ||
        !('x' in value.position) ||
        !('y' in value.position) ||
        value.position.x !== site.position.x ||
        value.position.y !== site.position.y ||
        !('frontier' in value) ||
        value.frontier !== site.frontier ||
        (value.frontier !== 'initial' && value.frontier !== 'expanded') ||
        !('queenHealth' in value) ||
        typeof value.queenHealth !== 'number' ||
        !Number.isFinite(value.queenHealth) ||
        value.queenHealth < 0 ||
        value.queenHealth > COOPERATIVE.queenHealth ||
        !('birthFramesLeft' in value) ||
        !integer(value.birthFramesLeft, COOPERATIVE.birthFrames) ||
        !('clearedAt' in value) ||
        !deadline(value.clearedAt) ||
        (value.clearedAt !== null) !== (value.queenHealth === 0) ||
        !('sacs' in value) ||
        !Array.isArray(value.sacs) ||
        value.sacs.length !== (value.frontier === 'initial' ? 2 : 3) ||
        !value.sacs.every(
          (health: unknown) =>
            typeof health === 'number' &&
            Number.isFinite(health) &&
            health >= 0 &&
            health <= COOPERATIVE.sacHealth
        ) ||
        !('sacDeadline' in value) ||
        !deadline(value.sacDeadline) ||
        !('sacsCompletedAt' in value) ||
        !deadline(value.sacsCompletedAt) ||
        !('restoredValue' in value) ||
        !integer(value.restoredValue, COOPERATIVE.restoreValue) ||
        !('contributors' in value) ||
        !Array.isArray(value.contributors) ||
        !value.contributors.every((id: unknown) => typeof id === 'string' && id.length > 0) ||
        new Set(value.contributors).size !== value.contributors.length ||
        !('commissionedAt' in value) ||
        !deadline(value.commissionedAt)
      ) {
        return false;
      }
      return (
        (value.commissionedAt !== null) === (value.restoredValue === COOPERATIVE.restoreValue) &&
        (value.restoredValue === 0 || value.clearedAt !== null) &&
        (value.sacsCompletedAt !== null) === value.sacs.every((hp: number) => hp === 0) &&
        (value.sacDeadline !== null) ===
          (value.sacsCompletedAt === null && value.sacs.some((hp: number) => hp === 0)) &&
        (value.sacsCompletedAt === null ||
          (value.sacs.every((hp: number) => hp === 0) && value.sacDeadline === null))
      );
    }
    default:
      return false;
  }
}

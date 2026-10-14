import type { ContourBridge } from '../../../shared-types';

let bridges: readonly ContourBridge[] = [];
export function setContourBridges(next: readonly ContourBridge[] = []): void {
  bridges = next;
}
export function getContourBridges(): readonly ContourBridge[] {
  return bridges;
}

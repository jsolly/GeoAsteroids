import { getCVS } from './constants.js';
import { Vector } from './vector.js';
import { Point } from './point.js';

type EventCallback = ((ev: Event) => void) | ((ev: Event) => Promise<void>);

function attachEventListener<T extends HTMLElement>(
  element: T | null,
  eventType: string,
  callback: EventCallback,
): void {
  if (element) {
    element.addEventListener(eventType, (ev) => {
      const result = callback(ev);
      if (result instanceof Promise) {
        result.catch((error) => console.error('UTILS', String(error)));
      }
    });
  } else {
    console.error(
      'UTILS',
      `Unable to attach event listener, element not found`,
    );
  }
}

function getElementById<T extends HTMLElement>(id: string): T | null {
  const element = document.getElementById(id);
  if (!element) {
    console.error('UTILS', `Element with id '${id}' not found`);
  }
  return element as T | null;
}

/**
 * Viewport transformation utilities
 * Converts between world coordinates and screen coordinates
 */

/**
 * Convert world coordinates to screen coordinates
 * @param worldPos - Position in world coordinates
 * @param shipPos - Ship position in world coordinates (viewport center)
 * @returns Position in screen coordinates
 */
export function worldToScreen(worldPos: Vector, shipPos: Vector): Point {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to default values if canvas is not available
    return new Point(worldPos.x - shipPos.x, worldPos.y - shipPos.y);
  }

  return new Point(
    cvs.width / 2 - shipPos.x + worldPos.x,
    cvs.height / 2 - shipPos.y + worldPos.y,
  );
}

/**
 * Convert screen coordinates to world coordinates
 * @param screenPos - Position in screen coordinates
 * @param shipPos - Ship position in world coordinates (viewport center)
 * @returns Position in world coordinates
 */
export function screenToWorld(screenPos: Point, shipPos: Vector): Vector {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to default values if canvas is not available
    return new Vector(screenPos.x + shipPos.x, screenPos.y + shipPos.y);
  }

  return new Vector(
    screenPos.x - cvs.width / 2 + shipPos.x,
    screenPos.y - cvs.height / 2 + shipPos.y,
  );
}

/**
 * Check if a world position is visible on screen
 * @param worldPos - Position in world coordinates
 * @param shipPos - Ship position in world coordinates
 * @param margin - Extra margin around screen edges
 * @returns True if position is visible
 */
export function isWorldPositionVisible(
  worldPos: Vector,
  shipPos: Vector,
  margin: number = 100,
): boolean {
  const cvs = getCVS();
  if (!cvs) {
    // Fallback to true if canvas is not available
    return true;
  }

  const screenPos = worldToScreen(worldPos, shipPos);
  return (
    screenPos.x >= -margin &&
    screenPos.x <= cvs.width + margin &&
    screenPos.y >= -margin &&
    screenPos.y <= cvs.height + margin
  );
}

export { Point, attachEventListener, getElementById };

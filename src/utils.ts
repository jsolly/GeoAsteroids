import { logger } from './logger.js';

class Point {
  constructor(readonly x: number, readonly y: number) {}

  /**
   * Returns the euclidian distance from the Point instance to another Point instance.
   */
  distToPoint(targetPoint: Point): number {
    return Math.floor(
      Math.sqrt(
        Math.pow(this.x - targetPoint.x, 2) +
          Math.pow(this.y - targetPoint.y, 2),
      ),
    );
  }
}

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
        result.catch((error) => logger.error(String(error)));
      }
    });
  } else {
    logger.error(`Unable to attach event listener, element not found`);
  }
}

function getElementById<T extends HTMLElement>(id: string): T | null {
  const element = document.getElementById(id);
  if (!element) {
    logger.error(`Element with id '${id}' not found`);
  }
  return element as T | null;
}

export { Point, attachEventListener, getElementById };

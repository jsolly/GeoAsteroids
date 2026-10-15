let listenerScope: AbortController | null = null;

import { boundedDiagnosticError } from '../../shared/stateDiagnostics';
import { logger } from './Logger';

/** Install one bounded page-level capture for errors outside local subsystem guards. */
export function installGlobalErrorLogging(): void {
  if (listenerScope !== null || typeof window === 'undefined') {
    return;
  }
  listenerScope = new AbortController();
  const { signal } = listenerScope;
  window.addEventListener(
    'error',
    (event) => {
      logger.error(
        'STATE',
        'global_error',
        boundedDiagnosticError(event.error ?? event.message, 'Unknown global error'),
        { observedAt: Date.now(), eventType: 'error' }
      );
    },
    { signal }
  );
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      logger.error(
        'STATE',
        'unhandled_rejection',
        boundedDiagnosticError(event.reason, 'Unhandled non-Error rejection'),
        { observedAt: Date.now(), eventType: 'unhandledrejection' }
      );
    },
    { signal }
  );
}

export function disposeGlobalErrorLogging(): void {
  listenerScope?.abort();
  listenerScope = null;
}

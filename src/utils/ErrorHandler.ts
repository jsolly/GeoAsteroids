/**
 * Centralized Error Handling System
 * Provides consistent error handling patterns and recovery strategies
 */

import { PALETTE, VISUAL } from '../constants';
import type { GameError, ValidationError } from '../types';
import { hexToRgba } from './colorUtils';
import { logger } from './Logger';

export interface ErrorHandlerConfig {
  readonly enableRetry: boolean;
  readonly maxRetries: number;
  readonly retryDelay: number;
  readonly enableFallbacks: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;

  private constructor() {
    this.config = {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableFallbacks: true,
    };
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Generic error handling with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    category: string,
    operationName: string,
    config?: Partial<ErrorHandlerConfig>
  ): Promise<T> {
    const effectiveConfig = { ...this.config, ...config };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= effectiveConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(category, `${operationName} attempt ${attempt} failed`, {
          attempt,
          maxRetries: effectiveConfig.maxRetries,
          error: lastError.message,
        });

        if (attempt < effectiveConfig.maxRetries) {
          await this.delay(effectiveConfig.retryDelay * attempt);
        }
      }
    }

    // All retries failed
    logger.error(
      category,
      `${operationName} failed after ${effectiveConfig.maxRetries} attempts`,
      lastError
    );
    if (lastError) {
      throw lastError;
    } else {
      throw new Error(`${operationName} failed after ${effectiveConfig.maxRetries} attempts`);
    }
  }

  /**
   * Handle network errors with specific recovery strategies
   */
  async handleNetworkError<T>(
    operation: () => Promise<T>,
    category: string,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const networkError = error as Error;

      if (this.isNetworkError(networkError)) {
        logger.warn(category, `Network error in ${operationName}`, {
          error: networkError.message,
          willRetry: true,
        });

        // Try with exponential backoff
        return this.withRetry(operation, category, operationName, {
          maxRetries: 5,
          retryDelay: 2000,
        });
      }

      throw networkError;
    }
  }

  /**
   * Graceful degradation with fallback values
   */
  withFallback<T>(operation: () => T, fallback: T, category: string, operationName: string): T {
    try {
      return operation();
    } catch (error) {
      logger.warn(category, `${operationName} failed, using fallback`, {
        error: (error as Error).message,
        fallback: typeof fallback,
      });
      return fallback;
    }
  }

  /**
   * Async graceful degradation
   */
  async withAsyncFallback<T>(
    operation: () => Promise<T>,
    fallback: T,
    category: string,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logger.warn(category, `${operationName} failed, using fallback`, {
        error: (error as Error).message,
        fallback: typeof fallback,
      });
      return fallback;
    }
  }

  /**
   * Handle validation errors with user feedback
   */
  handleValidationError(
    error: ValidationError,
    category: string,
    showUserMessage: boolean = true
  ): void {
    logger.error(category, 'Validation error', error, {
      code: error.code,
      context: error.context,
    });

    if (showUserMessage && typeof window !== 'undefined') {
      this.showUserError('Invalid input. Please check your data and try again.');
    }
  }

  /**
   * Handle game errors with appropriate user feedback
   */
  handleGameError(error: GameError, category: string, showUserMessage: boolean = true): void {
    logger.error(category, 'Game error', error, {
      code: error.code,
      context: error.context,
    });

    if (showUserMessage && typeof window !== 'undefined') {
      switch (error.code) {
        case 'NETWORK_ERROR':
          this.showUserError('Connection problem. Please check your internet and try again.');
          break;
        case 'VALIDATION_ERROR':
          this.showUserError('Invalid game state. The game may need to restart.');
          break;
        default:
          this.showUserError('An unexpected error occurred. Please restart the game.');
      }
    }
  }

  /**
   * Create a circuit breaker for fragile operations
   */
  createCircuitBreaker<T>(
    operation: () => T,
    failureThreshold: number = 3,
    recoveryTimeout: number = 30000
  ): () => T {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return () => {
      const now = Date.now();

      // Check if circuit should be reset
      if (isOpen && now - lastFailureTime > recoveryTimeout) {
        isOpen = false;
        failures = 0;
        logger.info('CIRCUIT_BREAKER', 'Circuit breaker reset');
      }

      if (isOpen) {
        throw new Error('Circuit breaker is open - operation temporarily disabled');
      }

      try {
        const result = operation();
        // Success - reset failure count
        failures = 0;
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= failureThreshold) {
          isOpen = true;
          logger.warn('CIRCUIT_BREAKER', `Circuit breaker opened after ${failures} failures`);
        }

        throw error;
      }
    };
  }

  /**
   * Log performance issues
   */
  logPerformanceIssue(
    operation: string,
    duration: number,
    threshold: number,
    category: string = 'PERFORMANCE'
  ): void {
    if (duration > threshold) {
      logger.warn(category, `Performance issue: ${operation} took ${duration}ms`, {
        operation,
        duration,
        threshold,
        exceededBy: duration - threshold,
      });
    }
  }

  /**
   * Check if error is network-related using comprehensive detection logic
   */
  private isNetworkError(error: unknown): boolean {
    // Handle non-Error objects
    if (!(error instanceof Error)) {
      return false;
    }

    const errorObj = error as Error & Record<string, unknown>;

    // 1. Check concrete error class instances
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
      // DOMException with network-related names
      const networkDomExceptions = ['NetworkError', 'TimeoutError', 'AbortError', 'SecurityError'];
      return error && typeof error.name === 'string' && networkDomExceptions.includes(error.name);
    }

    if (error instanceof TypeError) {
      // TypeError often indicates network issues (e.g., failed fetch)
      return error.message.includes('fetch') || error.message.includes('network');
    }

    // 2. Check standard error properties
    const errorName = errorObj.name || '';
    const errorCode = errorObj.code || errorObj.statusCode || '';

    // Common network error names
    const networkErrorNames = [
      'NetworkError',
      'TimeoutError',
      'AbortError',
      'ConnectionError',
      'WebSocketError',
      'FetchError',
    ];

    if (networkErrorNames.includes(errorName)) {
      return true;
    }

    // Common network error codes
    const networkErrorCodes = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'EPIPE',
      'ECONNRESET',
      'ERR_NETWORK',
      'ERR_CONNECTION_REFUSED',
      'ERR_CONNECTION_RESET',
    ];

    if (typeof errorCode === 'string' && networkErrorCodes.includes(errorCode)) {
      return true;
    }

    if (typeof errorCode === 'number') {
      // HTTP status codes indicating network issues
      const networkStatusCodes = [0, 408, 500, 502, 503, 504, 522, 524];
      if (networkStatusCodes.includes(errorCode)) {
        return true;
      }
    }

    // 3. Fall back to normalized regex-based message check
    const errorMessage = (errorObj.message || '').toLowerCase();

    // Use word boundaries for more accurate matching
    const networkPatterns = [
      /\bnetwork\b/i,
      /\bconnection\b/i,
      /\btimeout\b/i,
      /\bwebsocket\b/i,
      /\bfetch\b/i,
      /\babort\b/i,
      /\bdisconnected?\b/i,
      /\bunreachable\b/i,
      /\breset\b/i,
      /\brefused\b/i,
    ];

    return networkPatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Show user-friendly error message
   */
  private showUserError(message: string): void {
    // Create or update error display element
    let errorElement = document.getElementById('game-error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'game-error-message';
      errorElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${hexToRgba(PALETTE.BG, 0.92)};
        color: ${PALETTE.HUD};
        padding: 8px 16px;
        border: 1px solid ${PALETTE.DANGER};
        z-index: 10000;
        font-family: ${VISUAL.HUD_FONT_FAMILY};
        font-size: 13px;
        letter-spacing: 0.08em;
        max-width: 400px;
        text-align: center;
      `;
      document.body.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorElement) {
        errorElement.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const handleError = {
  withRetry: <T>(operation: () => Promise<T>, category: string, operationName: string) =>
    errorHandler.withRetry(operation, category, operationName),

  withFallback: <T>(operation: () => T, fallback: T, category: string, operationName: string) =>
    errorHandler.withFallback(operation, fallback, category, operationName),

  withAsyncFallback: <T>(
    operation: () => Promise<T>,
    fallback: T,
    category: string,
    operationName: string
  ) => errorHandler.withAsyncFallback(operation, fallback, category, operationName),

  networkError: <T>(operation: () => Promise<T>, category: string, operationName: string) =>
    errorHandler.handleNetworkError(operation, category, operationName),

  validationError: (error: ValidationError, category: string, showUserMessage?: boolean) =>
    errorHandler.handleValidationError(error, category, showUserMessage),

  gameError: (error: GameError, category: string, showUserMessage?: boolean) =>
    errorHandler.handleGameError(error, category, showUserMessage),
};

import { DEBUG, LOGGING } from '../constants';

export function isDebugMode(): boolean {
  return LOGGING.GLOBAL_LOG_LEVEL === 'debug' && DEBUG.ENABLED;
}

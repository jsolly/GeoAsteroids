// Simple debug mode management - just check environment variable
export function isDebugMode(): boolean {
  return import.meta.env.VITE_CLIENT_LOG_LEVEL === 'debug';
}

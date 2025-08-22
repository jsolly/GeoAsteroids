export function isDevelopmentMode(): boolean {
  return import.meta.env?.DEV === true || import.meta.env.MODE === 'development';
}

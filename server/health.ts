import process from 'node:process';
import type { GameEngine } from './core/GameEngine';
import type { ServerPerformanceSummary } from './performanceMetrics';
import { SERVER_RELEASE_ID } from './release';

export function buildHealthResponse(
  gameEngine: GameEngine,
  logging: Record<string, unknown>,
  metrics?: ServerPerformanceSummary
) {
  const healthy = gameEngine.isPersistenceHealthy();
  return {
    statusCode: healthy ? 200 : 503,
    body: {
      status: healthy ? 'healthy' : 'unhealthy',
      releaseId: SERVER_RELEASE_ID,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      world: gameEngine.getDiagnostics(),
      logging,
      ...(metrics ? { metrics } : {}),
    },
  };
}

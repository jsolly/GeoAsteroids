import { TestConfig } from './test-config';

export class HealthChecker {
  private static readonly HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

  /**
   * Check if the WebSocket server is running by calling its /health endpoint
   */
  static async checkWebSocketServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);
      
      const response = await fetch(`${TestConfig.SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`WebSocket server health check failed: ${response.status} ${response.statusText}`);
        return false;
      }
      
      const health = await response.json();
      console.log('✅ WebSocket server healthy:', health);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ WebSocket server health check timed out after 5s');
      } else {
        console.error('❌ WebSocket server health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Check if the Vite dev server is running by attempting to fetch the main page
   */
  static async checkViteServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);
      
      const response = await fetch(TestConfig.GAME_URL, {
        method: 'GET',
        headers: {
          'Accept': 'text/html',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Vite server health check failed: ${response.status} ${response.statusText}`);
        return false;
      }
      
      const html = await response.text();
      if (!html.includes('GeoRoids')) {
        console.error('Vite server responded but content seems incorrect');
        return false;
      }
      
      console.log('✅ Vite dev server healthy');
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ Vite dev server health check timed out after 5s');
      } else {
        console.error('❌ Vite dev server health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Check both servers and throw an error if either is not running
   */
  static async checkAllServers(): Promise<void> {
    console.log('🔍 Checking server health...');
    
    const [wsHealthy, viteHealthy] = await Promise.all([
      this.checkWebSocketServer(),
      this.checkViteServer()
    ]);
    
    if (!wsHealthy || !viteHealthy) {
      const errors = [];
      if (!wsHealthy) errors.push('WebSocket server not running');
      if (!viteHealthy) errors.push('Vite dev server not running');
      
      throw new Error(
        `Required servers not running:\n` +
        `- WebSocket server (${TestConfig.SERVER_URL}): ${wsHealthy ? '✅' : '❌'}\n` +
        `- Vite dev server (${TestConfig.GAME_URL}): ${viteHealthy ? '✅' : '❌'}\n\n` +
        `Please start both servers with: npm run dev\n` +
        `Errors: ${errors.join(', ')}`
      );
    }
    
    console.log('🎯 All servers are healthy!');
  }
}

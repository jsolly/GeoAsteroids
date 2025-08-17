// Simple file logging utility for debugging
export class SimpleLogger {
  private static instance: SimpleLogger;
  private logBuffer: string[] = [];
  private maxBufferSize: number = 1000; // Keep last 1000 log entries
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';
  private startTime: Date = new Date();
  private logServerUrl: string = 'http://localhost:3002';

  private constructor() {
    this.log('SYSTEM', 'Logger initialized');
  }

  public static getInstance(): SimpleLogger {
    if (!SimpleLogger.instance) {
      SimpleLogger.instance = new SimpleLogger();
    }
    return SimpleLogger.instance;
  }

  public setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
    this.info('SYSTEM', `Log level set to ${level}`);
  }

  public enable(): void {
    this.info('SYSTEM', 'Logger enabled');
  }

  public disable(): void {
    this.info('SYSTEM', 'Logger disabled');
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(
    level: string,
    category: string,
    message: string,
    data?: unknown,
  ): string {
    const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${category}] ${message}${dataStr}`;
  }

  private addToBuffer(logMessage: string): void {
    this.logBuffer.push(logMessage);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  private async sendToLogServer(
    level: string,
    category: string,
    message: string,
    data?: unknown,
  ): Promise<void> {
    try {
      const response = await fetch(`${this.logServerUrl}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          category,
          message,
          data,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to send log to log server:', response.status);
      }
    } catch {
      // Silently fail if log server is not available
      // This is expected when running without the log server
    }
  }

  public debug(category: string, message: string, data?: unknown): void {
    if (!this.shouldLog('debug')) return;
    const logMessage = this.formatMessage('debug', category, message, data);
    this.addToBuffer(logMessage);
    console.debug(logMessage);

    // Also send to log server (fire and forget)
    void this.sendToLogServer('debug', category, message, data);
  }

  public info(category: string, message: string, data?: unknown): void {
    if (!this.shouldLog('info')) return;
    const logMessage = this.formatMessage('info', category, message, data);
    this.addToBuffer(logMessage);
    console.info(logMessage);

    // Also send to log server (fire and forget)
    void this.sendToLogServer('info', category, message, data);
  }

  public warn(category: string, message: string, data?: unknown): void {
    if (!this.shouldLog('warn')) return;
    const logMessage = this.formatMessage('warn', category, message, data);
    this.addToBuffer(logMessage);
    console.warn(logMessage);

    // Also send to log server (fire and forget)
    void this.sendToLogServer('warn', category, message, data);
  }

  public error(category: string, message: string, data?: unknown): void {
    if (!this.shouldLog('error')) return;
    const logMessage = this.formatMessage('error', category, message, data);
    this.addToBuffer(logMessage);
    console.error(logMessage);

    // Also send to log server (fire and forget)
    void this.sendToLogServer('error', category, message, data);
  }

  public log(category: string, message: string, data?: unknown): void {
    this.info(category, message, data);
  }

  // Special method for bot-related logging
  public bot(category: string, message: string, data?: unknown): void {
    this.info(`BOT_${category}`, message, data);
  }

  // Special method for collision logging
  public collision(category: string, message: string, data?: unknown): void {
    this.info(`COLLISION_${category}`, message, data);
  }

  // Special method for ship logging
  public ship(category: string, message: string, data?: unknown): void {
    this.info(`SHIP_${category}`, message, data);
  }

  // Get all logs as a string
  public getLogs(): string {
    const header = `=== GeoAsteroids Debug Log ===
Started: ${this.startTime.toISOString()}
Current: ${new Date().toISOString()}
Total Entries: ${this.logBuffer.length}
===========================================

`;

    return header + this.logBuffer.join('\n');
  }

  // Download logs as a file
  public downloadLogs(filename?: string): void {
    const logContent = this.getLogs();
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download =
      filename ||
      `geoasteroids-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.info('SYSTEM', `Logs downloaded as ${a.download}`);
  }

  // Clear the log buffer
  public clear(): void {
    this.logBuffer = [];
    this.startTime = new Date();
    this.info('SYSTEM', 'Log buffer cleared');
  }

  // Get log buffer size
  public getBufferSize(): number {
    return this.logBuffer.length;
  }

  // Search logs for specific text
  public searchLogs(searchTerm: string): string[] {
    return this.logBuffer.filter((log) =>
      log.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }

  // Get logs for a specific category
  public getLogsByCategory(category: string): string[] {
    return this.logBuffer.filter((log) => log.includes(`[${category}]`));
  }

  // Get recent logs (last N entries)
  public getRecentLogs(count: number): string[] {
    return this.logBuffer.slice(-count);
  }

  // Add a separator line to logs
  public separator(message: string): void {
    const separator = `\n${'='.repeat(20)} ${message} ${'='.repeat(20)}\n`;
    this.addToBuffer(separator);
    console.log(separator);

    // Also send separator to log server (fire and forget)
    void this.sendToLogServer('info', 'SYSTEM', `=== ${message} ===`);
  }

  // Test connection to log server
  public async testLogServerConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.logServerUrl}/stats`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const logger = SimpleLogger.getInstance();

// Add global access for easy debugging
if (typeof window !== 'undefined') {
  // Extend the window object with our logger methods
  (window as unknown as Record<string, unknown>).logger = logger;
  (window as unknown as Record<string, unknown>).downloadLogs = (): void =>
    logger.downloadLogs();
  (window as unknown as Record<string, unknown>).clearLogs = (): void =>
    logger.clear();
  (window as unknown as Record<string, unknown>).searchLogs = (
    term: string,
  ): string[] => logger.searchLogs(term);
  (window as unknown as Record<string, unknown>).testLogServer =
    (): Promise<boolean> => logger.testLogServerConnection();
}

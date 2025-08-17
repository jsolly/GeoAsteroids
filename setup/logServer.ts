#!/usr/bin/env tsx

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  readFileSync,
} from 'fs';
import { join } from 'path';

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: unknown;
}

interface LogFileInfo {
  name: string;
  size: number;
  modified: string;
  path: string;
}

class LogServer {
  private logs: LogEntry[] = [];
  private maxLogs = 10000; // Keep last 10,000 logs in memory
  private port: number;
  private server: ReturnType<typeof createServer>;
  private logsDir: string;
  private currentLogFile: string;

  constructor(port: number = 3002) {
    this.port = port;
    this.server = createServer(this.handleRequest.bind(this));
    this.logsDir = join(process.cwd(), 'logs');
    this.currentLogFile = join(
      this.logsDir,
      `game-${new Date().toISOString().slice(0, 10)}.log`,
    );

    // Ensure logs directory exists
    this.ensureLogsDirectory();

    // Write server startup log
    this.writeToFile('SYSTEM', 'Log server started', {
      port,
      logsDir: this.logsDir,
    });
  }

  private ensureLogsDirectory(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
      console.log(`📁 Created logs directory: ${this.logsDir}`);
    }
  }

  private writeToFile(level: string, message: string, data?: unknown): void {
    try {
      const timestamp = new Date().toISOString();
      const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`;

      appendFileSync(this.currentLogFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  public addLog(
    level: string,
    category: string,
    message: string,
    data?: unknown,
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(logEntry);

    // Keep buffer size manageable
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Write to file
    this.writeToFile(category, message, data);

    // Also log to console for server-side visibility
    console.log(
      `[${logEntry.timestamp}] [${level.toUpperCase()}] [${category}] ${message}`,
      data || '',
    );
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      switch (path) {
        case '/':
          this.handleRoot(req, res);
          break;
        case '/logs':
          this.handleGetLogs(req, res, url);
          break;
        case '/log':
          this.handlePostLog(req, res);
          break;
        case '/clear':
          this.handleClearLogs(req, res);
          break;
        case '/search':
          this.handleSearchLogs(req, res, url);
          break;
        case '/stats':
          this.handleStats(req, res);
          break;
        case '/files':
          this.handleListLogFiles(req, res);
          break;
        case '/file':
          this.handleGetLogFile(req, res, url);
          break;
        default:
          this.handleNotFound(req, res);
      }
    } catch (error) {
      console.error('Log server error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private handleRoot(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>GeoAsteroids Log Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .controls { background: #333; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .logs { background: #000; padding: 20px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; }
        button { background: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #45a049; }
        button.danger { background: #f44336; }
        button.danger:hover { background: #da190b; }
        button.secondary { background: #2196F3; }
        button.secondary:hover { background: #1976D2; }
        input[type="text"] { padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin: 5px; width: 200px; }
        .log-entry { margin: 5px 0; padding: 5px; border-radius: 3px; }
        .log-debug { background: #2d2d2d; }
        .log-info { background: #1e3a8a; }
        .log-warn { background: #92400e; }
        .log-error { background: #991b1b; }
        .timestamp { color: #888; }
        .level { font-weight: bold; }
        .category { color: #60a5fa; }
        .message { color: #fff; }
        .file-list { background: #333; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .file-item { background: #444; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .file-name { font-weight: bold; color: #60a5fa; }
        .file-size { color: #888; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 GeoAsteroids Log Server</h1>
            <p>Real-time logging for debugging bot spawning and collision issues</p>
            <p><strong>Logs Directory:</strong> ${this.logsDir}</p>
            <p><strong>Current Log File:</strong> ${this.currentLogFile.split('/').pop()}</p>
        </div>
        
        <div class="controls">
            <button onclick="refreshLogs()">🔄 Refresh Logs</button>
            <button onclick="clearLogs()" class="danger">🗑️ Clear Memory</button>
            <button onclick="downloadLogs()">📥 Download Current</button>
            <button onclick="listLogFiles()" class="secondary">📁 List Log Files</button>
            <input type="text" id="searchInput" placeholder="Search logs..." onkeyup="searchLogs()">
            <button onclick="toggleAutoRefresh()" id="autoRefreshBtn">⏸️ Pause Auto-refresh</button>
        </div>
        
        <div class="file-list" id="fileList" style="display: none;">
            <h3>📁 Available Log Files</h3>
            <div id="fileListContent">Loading...</div>
        </div>
        
        <div class="logs" id="logsContainer">
            <div>Loading logs...</div>
        </div>
    </div>

    <script>
        let autoRefresh = true;
        let refreshInterval;

        function startAutoRefresh() {
            refreshInterval = setInterval(refreshLogs, 1000);
        }

        function stopAutoRefresh() {
            clearInterval(refreshInterval);
        }

        function toggleAutoRefresh() {
            if (autoRefresh) {
                stopAutoRefresh();
                autoRefresh = false;
                document.getElementById('autoRefreshBtn').textContent = '▶️ Resume Auto-refresh';
            } else {
                startAutoRefresh();
                autoRefresh = true;
                document.getElementById('autoRefreshBtn').textContent = '⏸️ Pause Auto-refresh';
            }
        }

        async function refreshLogs() {
            try {
                const response = await fetch('/logs');
                const logs = await response.json();
                displayLogs(logs);
            } catch (error) {
                console.error('Failed to fetch logs:', error);
            }
        }

        async function clearLogs() {
            if (confirm('Are you sure you want to clear all logs from memory? (Files will remain intact)')) {
                try {
                    await fetch('/clear', { method: 'DELETE' });
                    refreshLogs();
                } catch (error) {
                    console.error('Failed to clear logs:', error);
                }
            }
        }

        async function downloadLogs() {
            try {
                const response = await fetch('/logs');
                const logs = await response.json();
                const logText = logs.map(log => 
                    \`[\${log.timestamp}] [\${log.level.toUpperCase()}] [\${log.category}] \${log.message}\${log.data ? ' ' + JSON.stringify(log.data, null, 2) : ''}\`
                ).join('\\n');
                
                const blob = new Blob([logText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`geoasteroids-memory-logs-\${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log\`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Failed to download logs:', error);
            }
        }

        async function listLogFiles() {
            try {
                const response = await fetch('/files');
                const files = await response.json();
                displayFileList(files);
                document.getElementById('fileList').style.display = 'block';
            } catch (error) {
                console.error('Failed to fetch file list:', error);
            }
        }

        function displayFileList(files) {
            const container = document.getElementById('fileListContent');
            if (files.length === 0) {
                container.innerHTML = '<div>No log files found.</div>';
                return;
            }

            const fileHtml = files.map(file => {
                const sizeKB = (file.size / 1024).toFixed(1);
                return \`
                    <div class="file-item">
                        <div class="file-name">📄 \${file.name}</div>
                        <div class="file-size">Size: \${sizeKB} KB | Modified: \${file.modified}</div>
                        <button onclick="downloadFile('\${file.name}')" class="secondary">📥 Download</button>
                        <button onclick="viewFile('\${file.name}')" class="secondary">👁️ View</button>
                    </div>
                \`;
            }).join('');

            container.innerHTML = fileHtml;
        }

        async function downloadFile(filename) {
            try {
                const response = await fetch(\`/file?name=\${encodeURIComponent(filename)}\`);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Failed to download file:', error);
            }
        }

        async function viewFile(filename) {
            try {
                const response = await fetch(\`/file?name=\${encodeURIComponent(filename)}\`);
                const text = await response.text();
                
                // Create a new window to display the file
                const newWindow = window.open('', '_blank');
                newWindow.document.write(\`
                    <html>
                        <head>
                            <title>Viewing: \${filename}</title>
                            <style>
                                body { font-family: monospace; background: #1a1a1a; color: #fff; padding: 20px; }
                                pre { white-space: pre-wrap; }
                            </style>
                        </head>
                        <body>
                            <h1>📄 \${filename}</h1>
                            <pre>\${text}</pre>
                        </body>
                    </html>
                \`);
            } catch (error) {
                console.error('Failed to view file:', error);
            }
        }

        function searchLogs() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const logEntries = document.querySelectorAll('.log-entry');
            
            logEntries.forEach(entry => {
                const text = entry.textContent?.toLowerCase() || '';
                if (text.includes(searchTerm)) {
                    entry.style.display = 'block';
                } else {
                    entry.style.display = 'none';
                }
            });
        }

        function displayLogs(logs) {
            const container = document.getElementById('logsContainer');
            if (logs.length === 0) {
                container.innerHTML = '<div>No logs yet. Start the game to see logs!</div>';
                return;
            }

            const logHtml = logs.map(log => {
                const levelClass = \`log-\${log.level.toLowerCase()}\`;
                const dataStr = log.data ? \` <span class="data">\${JSON.stringify(log.data, null, 2)}</span>\` : '';
                return \`
                    <div class="log-entry \${levelClass}">
                        <span class="timestamp">[\${log.timestamp}]</span>
                        <span class="level">[\${log.level.toUpperCase()}]</span>
                        <span class="category">[\${log.category}]</span>
                        <span class="message">\${log.message}</span>\${dataStr}
                    </div>
                \`;
            }).join('');

            container.innerHTML = logHtml;
            container.scrollTop = container.scrollHeight;
        }

        // Start auto-refresh and initial load
        startAutoRefresh();
        refreshLogs();
    </script>
</body>
</html>
    `);
  }

  private handleGetLogs(
    _req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ): void {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const category = url.searchParams.get('category');
    const level = url.searchParams.get('level');
    const search = url.searchParams.get('search');

    let filteredLogs = [...this.logs];

    // Apply filters
    if (category) {
      filteredLogs = filteredLogs.filter((log) =>
        log.category.includes(category),
      );
    }
    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }
    if (search) {
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(search.toLowerCase()) ||
          log.category.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // Apply limit
    filteredLogs = filteredLogs.slice(-limit);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filteredLogs, null, 2));
  }

  private handlePostLog(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { level, category, message, data } = JSON.parse(body) as {
          level: string;
          category: string;
          message: string;
          data?: unknown;
        };

        if (!level || !category || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Missing required fields: level, category, message',
            }),
          );
          return;
        }

        this.addLog(level, category, message, data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, logCount: this.logs.length }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  private handleClearLogs(_req: IncomingMessage, res: ServerResponse): void {
    if (_req.method !== 'DELETE') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    this.logs = [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'All logs cleared from memory (files remain intact)',
      }),
    );
  }

  private handleSearchLogs(
    _req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ): void {
    const query = url.searchParams.get('q');
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing search query' }));
      return;
    }

    const results = this.logs.filter(
      (log) =>
        log.message.toLowerCase().includes(query.toLowerCase()) ||
        log.category.toLowerCase().includes(query.toLowerCase()),
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results, null, 2));
  }

  private handleStats(_req: IncomingMessage, res: ServerResponse): void {
    const stats = {
      totalLogs: this.logs.length,
      maxLogs: this.maxLogs,
      logsDirectory: this.logsDir,
      currentLogFile: this.currentLogFile.split('/').pop(),
      levels: this.logs.reduce(
        (acc, log) => {
          acc[log.level] = (acc[log.level] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      categories: this.logs.reduce(
        (acc, log) => {
          acc[log.category] = (acc[log.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
  }

  private handleListLogFiles(_req: IncomingMessage, res: ServerResponse): void {
    try {
      if (!existsSync(this.logsDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }

      const files = readdirSync(this.logsDir)
        .filter((file: string) => file.endsWith('.log'))
        .map((file: string): LogFileInfo => {
          const filePath = join(this.logsDir, file);
          const stats = statSync(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            path: filePath,
          };
        })
        .sort(
          (a: LogFileInfo, b: LogFileInfo) =>
            new Date(b.modified).getTime() - new Date(a.modified).getTime(),
        );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files, null, 2));
    } catch (error) {
      console.error('Error listing log files:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to list log files' }));
    }
  }

  private handleGetLogFile(
    _req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ): void {
    try {
      const filename = url.searchParams.get('name');
      if (!filename) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing filename parameter' }));
        return;
      }

      const filePath = join(this.logsDir, filename);

      // Security check: ensure the file is within the logs directory
      if (!filePath.startsWith(this.logsDir) || !filename.endsWith('.log')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      const content = readFileSync(filePath, 'utf8');

      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(content);
    } catch (error) {
      console.error('Error reading log file:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read log file' }));
    }
  }

  private handleNotFound(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`🚀 Log server running on http://localhost:${this.port}`);
      console.log(`📊 View logs: http://localhost:${this.port}`);
      console.log(`📝 POST logs to: http://localhost:${this.port}/log`);
      console.log(`🔍 Search logs: http://localhost:${this.port}/search?q=bot`);
      console.log(`📈 View stats: http://localhost:${this.port}/stats`);
      console.log(`📁 Logs directory: ${this.logsDir}`);
      console.log(`📄 Current log file: ${this.currentLogFile}`);
    });
  }

  public stop(): void {
    this.server.close(() => {
      console.log('🛑 Log server stopped');
    });
  }
}

// Start the log server
const logServer = new LogServer(3002);
logServer.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down log server...');
  logServer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down log server...');
  logServer.stop();
  process.exit(0);
});

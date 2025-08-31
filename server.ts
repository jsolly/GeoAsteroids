import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './setup/serverLogger';
import { WebSocketCore } from './server/communication/WebSocketCore';
import { GameEngine } from './server/core/GameEngine';
import { ClientLogger } from './server/services/ClientLogger';

// Production configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'production';

logger.info(`🚀 Starting ${NODE_ENV} multiplayer server on port ${PORT}`);

// Create HTTP server for health checks
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Add CORS headers for production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Log all incoming requests for debugging
  logger.debug('📥 HTTP Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers
  });

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        players: wsCore.getPlayerCount(),
        uptime: process.uptime(),
      })
    );
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GeoRoids Multiplayer Server - Running');
  } else if (req.url === '/ws') {
    // Handle WebSocket upgrade
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('WebSocket connections should use ws:// protocol');
  } else if (req.url === '/logs') {
    // Handle WebSocket upgrade for logs
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('WebSocket connections should use ws:// protocol');
  } else if (req.url === '/test-server-log') {
    // Handle POST request to trigger server-side logging
    if (req.method === 'POST') {
      logger.info('🧪 Test server log triggered from /status page');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        message: 'Test server log written to server.log',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }
  } else if (req.url === '/status') {
    // Check if client prefers JSON (curl, API calls) or HTML (browser)
    const acceptHeader = req.headers.accept || '';
    const userAgent = req.headers['user-agent'] || '';
    const prefersJson = userAgent.includes('curl') ||
                       userAgent.includes('wget') ||
                       userAgent.includes('httpie') ||
                       acceptHeader.includes('application/json');
    
    if (prefersJson) {
      // Return structured JSON for API/debugging
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      // Get current server stats
      const serverStats = {
        timestamp: new Date().toISOString(),
        server: {
          status: 'healthy',
          uptime: process.uptime(),
          port: PORT,
          nodeEnv: NODE_ENV
        },
        websockets: {
          game: {
            endpoint: `ws://localhost:${PORT}/ws`,
            status: 'available',
            description: 'Gameplay WebSocket for multiplayer functionality'
          },
          logs: {
            endpoint: `ws://localhost:${PORT}/logs`,
            status: 'available',
            description: 'Log forwarding WebSocket for client logs'
          }
        },
        connections: {
          currentPlayers: wsCore.getPlayerCount(),
          maxPlayers: 100, // You can adjust this based on your game design
          activeLogClients: 0 // You could track this if needed
        },
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          status: `http://localhost:${PORT}/status`,
          gameWs: `ws://localhost:${PORT}/ws`,
          logWs: `ws://localhost:${PORT}/logs`
        },
        version: {
          node: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
      
      res.end(JSON.stringify(serverStats, null, 2));
    } else {
      // Return HTML for browser access
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Status - GeoAsteroids</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { background: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .connected { background: #2d5a2d; }
        .disconnected { background: #5a2d2d; }
        .connecting { background: #5a5a2d; }
        .error { background: #8b0000; }
        .log { background: #333; padding: 8px; margin: 5px 0; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .log.error { border-left: 4px solid #ff4444; }
        .log.info { border-left: 4px solid #44ff44; }
        .log.debug { border-left: 4px solid #4444ff; }
        .log.warn { border-left: 4px solid #ffff44; }
        button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #45a049; }
        button:disabled { background: #666; cursor: not-allowed; }
        .controls { margin: 20px 0; }
        .connection-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .metric { background: #333; padding: 15px; border-radius: 4px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .metric-value.connected { color: #4CAF50; }
        .metric-value.disconnected { color: #ff4444; }
        .metric-value.connecting { color: #ffff44; }
        .metric-value.error { color: #ff4444; }
        .metric-label { font-size: 12px; color: #aaa; margin-top: 5px; }
        .overall-status { margin: 20px 0; text-align: center; }
        .status-indicator { 
            display: inline-flex; 
            align-items: center; 
            padding: 15px 25px; 
            border-radius: 8px; 
            font-size: 18px; 
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .status-indicator.connected { 
            background: #2d5a2d; 
            color: #4CAF50;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        }
        .status-indicator.disconnected { 
            background: #5a2d2d; 
            color: #ff4444;
        }
        .status-indicator.partial { 
            background: #5a5a2d; 
            color: #ffff44;
        }
        .status-icon { margin-right: 10px; font-size: 24px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>&#128295; WebSocket Status Console</h1>
        
        <div class="section">
            <h2>Connection Status</h2>
            <div class="connection-info">
                <div class="metric">
                    <div class="metric-value" id="gameStatus">Disconnected</div>
                    <div class="metric-label">Game WebSocket</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="logStatus">Disconnected</div>
                    <div class="metric-label">Log WebSocket</div>
                </div>
            </div>
            
            <div id="overallStatus" class="overall-status">
                <div class="status-indicator disconnected">
                    <span class="status-icon">❌</span>
                    <span class="status-text">Both WebSockets Disconnected</span>
                </div>
            </div>
            
            <div class="controls">
                <button onclick="connectGame()" id="connectGameBtn">Connect Game</button>
                <button onclick="disconnectGame()" id="disconnectGameBtn" disabled>Disconnect Game</button>
                <button onclick="connectLogs()" id="connectLogsBtn">Connect Logs</button>
                <button onclick="disconnectLogs()" id="disconnectLogsBtn" disabled>Disconnect Logs</button>
                <button onclick="testAllConnections()" id="testAllBtn">Test All Connections</button>
                <button onclick="clearLogs()">Clear Logs</button>
                <button onclick="testLogMessage()" id="testLogBtn" disabled>Test Log Message</button>
                <br><br>
                <button onclick="sendServerLog()" id="serverLogBtn">Send Server Log</button>
                <button onclick="sendClientLog()" id="clientLogBtn">Send Client Log</button>
            </div>
        </div>
        
        <div class="section">
            <h2>Connection Details</h2>
            <div id="connectionDetails">
                <div class="log info">No connections established</div>
            </div>
        </div>
        
        <div class="section">
            <h2>Message Log</h2>
            <div id="messageLog"></div>
        </div>
        
        <div class="section">
            <h2>Server Health</h2>
            <div id="serverHealth">Checking...</div>
        </div>
    </div>

    <script>
        let gameWs = null;
        let logWs = null;
        let messageCount = 0;
        
        function addLog(message, type = 'info') {
            const logDiv = document.getElementById('messageLog');
            const logEntry = document.createElement('div');
            logEntry.className = \`log \${type}\`;
            logEntry.textContent = \`[\${new Date().toISOString()}] \${message}\`;
            logDiv.appendChild(logEntry);
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        function updateStatus(elementId, status, className) {
            const element = document.getElementById(elementId);
            element.textContent = status;
            element.className = \`metric-value \${className}\`;
        }
        
        function updateOverallStatus() {
            const overallStatusDiv = document.getElementById('overallStatus');
            const gameConnected = gameWs && gameWs.readyState === WebSocket.OPEN;
            const logConnected = logWs && logWs.readyState === WebSocket.OPEN;
            
            let statusClass, statusIcon, statusText;
            
            if (gameConnected && logConnected) {
                statusClass = 'connected';
                statusIcon = '✅';
                statusText = 'Both WebSockets Connected - All Systems Go!';
            } else if (gameConnected || logConnected) {
                statusClass = 'partial';
                statusIcon = '⚠️';
                statusText = \`Partial Connection - Game: \${gameConnected ? 'Connected' : 'Disconnected'}, Logs: \${logConnected ? 'Connected' : 'Disconnected'}\`;
            } else {
                statusClass = 'disconnected';
                statusIcon = '❌';
                statusText = 'Both WebSockets Disconnected';
            }
            
            overallStatusDiv.innerHTML = \`
                <div class="status-indicator \${statusClass}">
                    <span class="status-icon">\${statusIcon}</span>
                    <span class="status-text">\${statusText}</span>
                </div>
            \`;
        }
        
        function updateConnectionDetails() {
            const detailsDiv = document.getElementById('connectionDetails');
            detailsDiv.innerHTML = '';
            
            if (gameWs && gameWs.readyState === WebSocket.OPEN) {
                const gameInfo = document.createElement('div');
                gameInfo.className = 'log info';
                gameInfo.textContent = \`Game WebSocket: OPEN (readyState: \${gameWs.readyState})\`;
                detailsDiv.appendChild(gameInfo);
            }
            
            if (logWs && logWs.readyState === WebSocket.OPEN) {
                const logInfo = document.createElement('div');
                logInfo.className = 'log info';
                logInfo.textContent = \`Log WebSocket: OPEN (readyState: \${logWs.readyState})\`;
                detailsDiv.appendChild(logInfo);
            }
            
            if (!gameWs && !logWs) {
                const noConn = document.createElement('div');
                noConn.className = 'log info';
                noConn.textContent = 'No connections established';
                detailsDiv.appendChild(noConn);
            }
            
            updateOverallStatus();
        }
        
        function connectGame() {
            try {
                gameWs = new WebSocket('ws://localhost:3001/ws');
                
                gameWs.onopen = function() {
                    addLog('Game WebSocket connected', 'info');
                    updateStatus('gameStatus', 'Connected', 'connected');
                    document.getElementById('connectGameBtn').disabled = true;
                    document.getElementById('disconnectGameBtn').disabled = false;
                    updateConnectionDetails();
                };
                
                gameWs.onmessage = function(event) {
                    messageCount++;
                    addLog(\`Game message received: \${event.data}\`, 'info');
                };
                
                gameWs.onclose = function(event) {
                    addLog(\`Game WebSocket closed: \${event.code} - \${event.reason}\`, 'warn');
                    updateStatus('gameStatus', 'Disconnected', 'disconnected');
                    document.getElementById('connectGameBtn').disabled = false;
                    document.getElementById('disconnectGameBtn').disabled = true;
                    gameWs = null;
                    updateConnectionDetails();
                };
                
                gameWs.onerror = function(error) {
                    addLog(\`Game WebSocket error: \${JSON.stringify(error)}\`, 'error');
                    updateStatus('gameStatus', 'Error', 'error');
                };
                
                addLog('Connecting to game WebSocket...', 'info');
                updateStatus('gameStatus', 'Connecting', 'connecting');
                
            } catch (error) {
                addLog(\`Failed to create game WebSocket: \${error.message}\`, 'error');
            }
        }
        
        function disconnectGame() {
            if (gameWs) {
                gameWs.close();
            }
        }
        
        function connectLogs() {
            try {
                logWs = new WebSocket('ws://localhost:3001/logs');
                
                logWs.onopen = function() {
                    addLog('Log WebSocket connected', 'info');
                    updateStatus('logStatus', 'Connected', 'connected');
                    document.getElementById('connectLogsBtn').disabled = true;
                    document.getElementById('disconnectLogsBtn').disabled = false;
                    document.getElementById('testLogBtn').disabled = false;
                    updateConnectionDetails();
                };
                
                logWs.onmessage = function(event) {
                    messageCount++;
                    addLog(\`Log message received: \${event.data}\`, 'info');
                };
                
                logWs.onclose = function(event) {
                    addLog(\`Log WebSocket closed: \${event.code} - \${event.reason}\`, 'warn');
                    updateStatus('logStatus', 'Disconnected', 'disconnected');
                    document.getElementById('connectLogsBtn').disabled = false;
                    document.getElementById('disconnectLogsBtn').disabled = true;
                    document.getElementById('testLogBtn').disabled = true;
                    logWs = null;
                    updateConnectionDetails();
                };
                
                logWs.onerror = function(error) {
                    addLog(\`Log WebSocket error: \${JSON.stringify(error)}\`, 'error');
                    updateStatus('logStatus', 'Error', 'error');
                };
                
                addLog('Connecting to log WebSocket...', 'info');
                updateStatus('logStatus', 'Connecting', 'connecting');
                
            } catch (error) {
                addLog(\`Failed to create log WebSocket: \${error.message}\`, 'error');
            }
        }
        
        function disconnectLogs() {
            if (logWs) {
                logWs.close();
            }
        }
        
        function testLogMessage() {
            if (logWs && logWs.readyState === WebSocket.OPEN) {
                const testMessage = {
                    type: 'clientLog',
                    timestamp: Date.now(),
                    data: {
                        sessionId: 'debug-session-' + Date.now(),
                        level: 'INFO',
                        line: \`[\${new Date().toISOString()}] INFO Test message from debug console\`,
                        message: 'Test message from debug console',
                        userAgent: navigator.userAgent,
                        pageUrl: location.href
                    }
                };
                
                logWs.send(JSON.stringify(testMessage));
                addLog(\`Test log message sent: \${JSON.stringify(testMessage)}\`, 'info');
            }
        }
        
        function testAllConnections() {
            addLog('Testing all WebSocket connections...', 'info');
            
            // Disconnect existing connections first
            if (gameWs) {
                gameWs.close();
                gameWs = null;
            }
            if (logWs) {
                logWs.close();
                logWs = null;
            }
            
            // Wait a moment, then connect both
            setTimeout(() => {
                connectGame();
                setTimeout(() => {
                    connectLogs();
                }, 500);
            }, 200);
        }
        
        function clearLogs() {
            document.getElementById('messageLog').innerHTML = '';
            messageCount = 0;
        }
        
        function checkServerHealth() {
            fetch('http://localhost:3001/health')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('serverHealth').innerHTML = \`
                        <div class="log info">✅ Server is healthy</div>
                        <div class="log info">Status: \${data.status}</div>
                        <div class="log info">Players: \${data.players}</div>
                        <div class="log info">Uptime: \${data.uptime.toFixed(2)}s</div>
                        <div class="log info">Timestamp: \${data.timestamp}</div>
                    \`;
                })
                .catch(error => {
                    document.getElementById('serverHealth').innerHTML = \`
                        <div class="log error">❌ Server health check failed: \${error.message}</div>
                    \`;
                });
        }

        function sendServerLog() {
            const button = document.getElementById('serverLogBtn');
            const originalText = button.textContent;
            button.textContent = 'Sending...';
            button.disabled = true;

            fetch('http://localhost:3001/test-server-log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                addLog(\`Server log sent successfully: \${data.message}\`, 'info');
                button.textContent = '✅ Sent!';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                }, 2000);
            })
            .catch(error => {
                addLog(\`Failed to send server log: \${error.message}\`, 'error');
                button.textContent = '❌ Failed';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                }, 2000);
            });
        }

        function sendClientLog() {
            const button = document.getElementById('clientLogBtn');
            const originalText = button.textContent;
            button.textContent = 'Sending...';
            button.disabled = true;

            try {
                // Create a WebSocket connection to send a test log message directly to the server
                const ws = new WebSocket('ws://localhost:3001/logs');
                
                ws.onopen = function() {
                    try {
                        const testMessage = {
                            type: 'clientLog',
                            timestamp: Date.now(),
                            data: {
                                sessionId: 'status-page-test',
                                level: 'INFO',
                                line: '[Status Page Test] INFO Test client log from /status page',
                                message: 'Test client log from /status page - this should appear in client.log',
                                userAgent: navigator.userAgent,
                                pageUrl: location.href
                            }
                        };
                        
                        ws.send(JSON.stringify(testMessage));
                        addLog('Client log sent directly to server via WebSocket', 'info');
                        
                        button.textContent = 'Sent!';
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.disabled = false;
                        }, 2000);
                        
                        // Close the WebSocket after sending
                        setTimeout(() => ws.close(), 100);
                    } catch (error) {
                        addLog(\`Failed to send log message: \${error.message}\`, 'error');
                        button.textContent = 'Failed';
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.disabled = false;
                        }, 2000);
                        ws.close();
                    }
                };
                
                ws.onerror = function(error) {
                    addLog(\`WebSocket connection failed: \${error}\`, 'error');
                    button.textContent = 'Failed';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 2000);
                };
                
                ws.onclose = function() {
                    // Connection closed, nothing to do here
                };
                
            } catch (error) {
                addLog(\`Failed to create WebSocket: \${error.message}\`, 'error');
                button.textContent = 'Failed';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                }, 2000);
            }
        }
        
        // Check server health every 5 seconds
        setInterval(checkServerHealth, 5000);
        checkServerHealth();
        
        // Initial connection details
        updateConnectionDetails();
    </script>
</body>
</html>
      `);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Create single WebSocket server that handles both paths
const wss = new WebSocketServer({
  server: httpServer,
  // Don't specify path here - we'll handle routing manually
});

// Connection rate limiting to prevent abuse
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CONNECTIONS_PER_MINUTE = 10;
const CONNECTION_WINDOW_MS = 60000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = connectionAttempts.get(ip);
  
  if (!attempts) {
    connectionAttempts.set(ip, { count: 1, lastAttempt: now });
    return false;
  }
  
  // Reset if outside window
  if (now - attempts.lastAttempt > CONNECTION_WINDOW_MS) {
    connectionAttempts.set(ip, { count: 1, lastAttempt: now });
    return false;
  }
  
  // Check if over limit
  if (attempts.count >= MAX_CONNECTIONS_PER_MINUTE) {
    return true;
  }
  
  // Increment count
  attempts.count++;
  attempts.lastAttempt = now;
  return false;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of connectionAttempts.entries()) {
    if (now - attempts.lastAttempt > CONNECTION_WINDOW_MS) {
      connectionAttempts.delete(ip);
    }
  }
}, CONNECTION_WINDOW_MS);

// Add error handling for WebSocket server
wss.on('error', (error) => {
  logger.error('❌ WebSocket server error:', error);
});

wss.on('headers', (_headers) => {
  // Debug: WebSocket upgrade headers
  // logger.debug('📋 WebSocket upgrade headers:', _headers);
});

// Initialize game engine and WebSocket core
const gameEngine = new GameEngine();
const wsCore = new WebSocketCore(gameEngine);
wsCore.startPeriodicGameStateBroadcast();

// WebSocket connection handling with routing
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = req.url;
  const clientIp = req.socket.remoteAddress || 'unknown';
  
  // Rate limiting check
  if (isRateLimited(clientIp)) {
    logger.warn(`🚫 Rate limited connection attempt from ${clientIp}`);
    ws.close(1008, 'Rate limit exceeded');
    return;
  }
  
  // Debug: WebSocket connection request details
  // logger.debug('🔌 WebSocket connection request:', { url, headers: req.headers });

  if (url === '/logs') {
    // Handle log client connection
    // Debug: Log client connected
    logger.info('📝 Log client connected');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(String(data));
        if (message.type === 'clientLog') {
          // Handle client log message
          const logData = message.data;
          
          // Persist client logs to logs/client.log
          // Use best-effort write; do not await to avoid blocking WS loop
          ClientLogger.logClientMessage(logData).catch((error) => {
            logger.warn('Failed to write client log to file:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to parse log message:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

    ws.on('close', () => {
      // Debug: Log client disconnected
      logger.info('📝 Log client disconnected');
    });

    ws.on('error', (error) => {
      logger.error('❌ Log WebSocket error:', error);
    });
  } else if (url === '/ws') {
    // Handle gameplay client connection
    logger.info('🔌 New player connected');
    // Debug: Connection details
    // logger.debug('📍 Connection details:', {
    //   url: req.url,
    //   headers: req.headers,
    //   remoteAddress: req.socket.remoteAddress,
    // });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(String(data));
        wsCore.handleClientMessage(message, ws);
      } catch (error) {
        logger.error('Failed to parse client message:', error instanceof Error ? error.message : 'Unknown error');
        wsCore.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      logger.info('🔌 Player disconnected');
      // Find and remove the player
      for (const player of wsCore.getAllPlayers()) {
        if (player.ws === ws) {
          wsCore.removePlayer(player.id);
          break;
        }
      }
    });

    ws.on('error', (error) => {
      logger.error('❌ WebSocket error:', error);
    });
  } else {
    // Unknown WebSocket path
    logger.warn('❌ Unknown WebSocket path:', url);
    ws.close(1008, 'Unknown path');
  }
});

// Start the server
httpServer.listen(PORT, () => {
  logger.info(`✅ Server listening on port ${PORT}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
  logger.info(`📊 Status page: http://localhost:${PORT}/status`);
  logger.info(`🔌 Gameplay WebSocket: ws://localhost:${PORT}/ws`);
  logger.info(`📝 Log WebSocket: ws://localhost:${PORT}/logs`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

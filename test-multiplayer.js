import WebSocket from 'ws';

// Test the multiplayer connection with our fixes
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  console.log('✅ Connected to server');

  // Send join message with the correct format (data instead of payload)
  const joinMessage = {
    type: 'join',
    id: 'test-player-123',
    data: {
      name: 'TestPlayer'
    },
    timestamp: Date.now()
  };

  console.log('📤 Sending join message:', JSON.stringify(joinMessage, null, 2));
  ws.send(JSON.stringify(joinMessage));

  // Send initBots message after a short delay
  setTimeout(() => {
    const initBotsMessage = {
      type: 'initBots',
      id: 'test-player-123',
      data: {
        botCount: 5
      },
      timestamp: Date.now()
    };

    console.log('📤 Sending initBots message:', JSON.stringify(initBotsMessage, null, 2));
    ws.send(JSON.stringify(initBotsMessage));
  }, 500);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', JSON.stringify(message, null, 2));
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});

// Close after 3 seconds
setTimeout(() => {
  ws.close();
}, 3000);

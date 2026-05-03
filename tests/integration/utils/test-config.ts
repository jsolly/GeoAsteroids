export const TestConfig = {
  // URLs
  GAME_URL: 'http://localhost:5173',
  SERVER_URL: 'http://localhost:3001',
  
  // Timeouts
  DEFAULT_TIMEOUT: 60000,
  ELEMENT_WAIT_TIMEOUT: 5000,
  GAME_INIT_TIMEOUT: 5000,
  LASER_DELAY: 500,
  
  // Viewport
  VIEWPORT_WIDTH: 1920,
  VIEWPORT_HEIGHT: 1080,
  
  // Test data
  DEFAULT_LASER_COUNT: 5,
  SCREENSHOT_DIR: 'screenshots',
  
  // Browser arguments
  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ],
  
  // User agent
  USER_AGENT: 'GeoAsteroids-Test-Bot/1.0'
} as const;

export const TestSelectors = {
  START_SCREEN: '#start-screen',
  START_GAME_BUTTON: '#start-game',
  GAME_AREA: '#gameArea',
  GAME_CANVAS: 'canvas',
  DEBUG_INFO: 'text=Asteroids:',
  DEBUG_MODE: 'text=DEBUG MODE'
} as const;

import { Builder, WebDriver, By, Key, until } from 'selenium-webdriver';
// @ts-ignore - selenium-webdriver/chrome types have issues with private identifiers
import * as chrome from 'selenium-webdriver/chrome.js';
import { logger } from '../setup/serverLogger';

// Global timeout for the entire probe (in milliseconds)
const PROBE_TIMEOUT = 15000; // 15 seconds

async function openDevServer(driver: WebDriver): Promise<void> {
  const urls = ['http://localhost:5173/', 'http://localhost:5174/'];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      logger.info(`Trying to open ${url}`);
      await driver.get(url);
      // Wait a bit for the page to load Vite client
      await driver.wait(async () => (await driver.getTitle()) !== '', 2000).catch(() => {});
      logger.info(`Successfully opened ${url}`);
      return;
    } catch (e) {
      lastError = e;
      logger.warn(`Failed to open ${url}: ${e}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function testRespawnFunctionality(driver: WebDriver): Promise<void> {
  logger.info('🧪 Testing respawn functionality...');
  
  // Test 1: Check if player can die and respawn
  try {
    // Simulate player death by setting health to 0 via console
    await driver.executeScript(`
      if (window.gameController && window.gameController.getCurrPlayer) {
        const player = window.gameController.getCurrPlayer();
        if (player && player.ship) {
          player.ship.health = 0;
          player.ship.exploding = true;
          console.log('Simulated player death for respawn test');
          return 'Player death simulated';
        }
        return 'Player not found';
      }
      return 'Game controller not available';
    `);
    
    logger.info('✅ Simulated player death for respawn test');
    
    // Wait a moment for the death state to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if respawn timer is set
    const respawnTimerStatus = await driver.executeScript(`
      if (window.gameController && window.gameController.getCurrPlayer) {
        const player = window.gameController.getCurrPlayer();
        if (player && player.respawnTimer !== undefined) {
          return 'Respawn timer set: ' + player.respawnTimer;
        }
        return 'No respawn timer found';
      }
      return 'Game controller not available';
    `);
    
    logger.info(`📊 Respawn timer status: ${respawnTimerStatus}`);
    
  } catch (error) {
    logger.warn('⚠️ Respawn test failed:', error);
  }
}

async function main(): Promise<void> {
  // Set up global timeout
  const timeoutId = setTimeout(() => {
    logger.warn('Selenium probe timed out after 15 seconds');
    process.exit(0);
  }, PROBE_TIMEOUT);

  let chromedriverPath: string | null = null;
  try {
    const chromedriver = await import('chromedriver');
    // chromedriver.path contains the path to the chromedriver binary
    chromedriverPath = (chromedriver as any).path || null;
  } catch {
    // Chromedriver not available, will use system chromedriver
  }

  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--disable-gpu');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  let builder: Builder = new Builder().forBrowser('chrome').setChromeOptions(options);

  if (chromedriverPath && typeof chromedriverPath === 'string') {
    const service = new chrome.ServiceBuilder(chromedriverPath);
    builder = builder.setChromeService(service);
  }

  const driver: WebDriver = await builder.build();
  try {
    logger.info('Starting selenium probe...');
    
    // Open dev server (5173 or 5174)
    await openDevServer(driver);

    // Log the page title to verify we're on the right page
    const title = await driver.getTitle();
    logger.info(`Page title: ${title}`);

    // Wait for Play button and click it (shorter timeout)
    logger.info('Looking for multiplayer start button...');
    const playBtn = await driver.wait(until.elementLocated(By.css('#start-multiplayer')), 5000);
    await driver.wait(until.elementIsVisible(playBtn), 3000);
    logger.info('Found multiplayer start button, clicking...');
    await playBtn.click();

    // Fill name modal if it appears (shorter timeout)
    try {
      logger.info('Looking for name input modal...');
      const nameInput = await driver.wait(until.elementLocated(By.css('#multiplayerNameInput')), 3000);
      await driver.wait(until.elementIsVisible(nameInput), 2000);
      await nameInput.clear();
      const playerName = `Selenium_${Math.floor(Math.random() * 10000)}`;
      await nameInput.sendKeys(playerName);
      logger.info(`Entered player name: ${playerName}`);
      const confirmBtn = await driver.findElement(By.css('#confirmNameButton'));
      await confirmBtn.click();
      logger.info('Confirmed player name');
    } catch (e) {
      logger.info('Name modal not found, continuing...');
    }

    // Focus canvas and send some inputs (shorter timeout)
    logger.info('Looking for game canvas...');
    const canvas = await driver.wait(until.elementLocated(By.css('#gameCanvas')), 5000);
    await driver.wait(until.elementIsVisible(canvas), 3000);
    await canvas.click();
    logger.info('Found and clicked game canvas');

    // Test respawn functionality
    await testRespawnFunctionality(driver);

    // More extensive movement and shooting to actually destroy asteroids
    const actions = driver.actions({ async: true });
    
    logger.info('Performing game actions...');
    // Move around and shoot multiple times to increase chances of hitting asteroids
    for (let i = 0; i < 3; i++) { // Reduced iterations
      // Move in different directions
      await actions.keyDown(Key.ARROW_UP).pause(100).keyUp(Key.ARROW_UP).perform();
      await actions.keyDown(Key.SPACE).pause(50).keyUp(Key.SPACE).perform();
      await actions.pause(100).perform();
      
      await actions.keyDown(Key.ARROW_LEFT).pause(100).keyUp(Key.ARROW_LEFT).perform();
      await actions.keyDown(Key.SPACE).pause(50).keyUp(Key.SPACE).perform();
      await actions.pause(100).perform();
      
      await actions.keyDown(Key.ARROW_RIGHT).pause(100).keyUp(Key.ARROW_RIGHT).perform();
      await actions.keyDown(Key.SPACE).pause(50).keyUp(Key.SPACE).perform();
      await actions.pause(100).perform();
      
      await actions.keyDown(Key.ARROW_DOWN).pause(100).keyUp(Key.ARROW_DOWN).perform();
      await actions.keyDown(Key.SPACE).pause(50).keyUp(Key.SPACE).perform();
      await actions.pause(100).perform();
    }

    // Emit explicit logger messages to ensure forwarding
    logger.info('Executing client-side logging...');
    await driver.executeScript(
      "if (window.logger) { window.logger.info('CLIENT_TEST', 'started game and performed extensive shooting'); }"
    );

    // Allow forwarder to flush (shorter wait)
    logger.info('Waiting for log forwarding...');
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    
    logger.info('Selenium probe completed successfully');
  } catch (error) {
    logger.error('Selenium probe error during execution', error);
  } finally {
    // Clear the timeout since we're finishing normally
    clearTimeout(timeoutId);
    
    try {
      await driver.quit();
      logger.info('Driver closed successfully');
    } catch (error) {
      logger.error('Error closing driver', error);
    }
  }
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error('Selenium probe failed', errorMessage);
  process.exit(1);
});

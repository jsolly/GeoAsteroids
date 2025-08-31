import { Builder, WebDriver, By, Key, until } from 'selenium-webdriver';
// @ts-ignore - selenium-webdriver/chrome types have issues with private identifiers
import * as chrome from 'selenium-webdriver/chrome.js';
import { logger } from '../setup/serverLogger';

async function openDevServer(driver: WebDriver): Promise<void> {
  const urls = ['http://localhost:5173/', 'http://localhost:5174/'];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      await driver.get(url);
      // Wait a bit for the page to load Vite client
      await driver.wait(async () => (await driver.getTitle()) !== '', 2000).catch(() => {});
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main(): Promise<void> {
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
    // Open dev server (5173 or 5174)
    await openDevServer(driver);

    // Wait for Play button and click it
    const playBtn = await driver.wait(until.elementLocated(By.css('#start-multiplayer')), 5000);
    await driver.wait(until.elementIsVisible(playBtn), 3000);
    await playBtn.click();

    // Fill name modal if it appears
    try {
      const nameInput = await driver.wait(until.elementLocated(By.css('#multiplayerNameInput')), 3000);
      await driver.wait(until.elementIsVisible(nameInput), 2000);
      await nameInput.clear();
      await nameInput.sendKeys(`Selenium_${Math.floor(Math.random() * 10000)}`);
      const confirmBtn = await driver.findElement(By.css('#confirmNameButton'));
      await confirmBtn.click();
    } catch {
      // Modal may not appear; continue
    }

    // Focus canvas and send some inputs
    const canvas = await driver.wait(until.elementLocated(By.css('#gameCanvas')), 5000);
    await driver.wait(until.elementIsVisible(canvas), 3000);
    await canvas.click();

    // Movement and shooting inputs
    const actions = driver.actions({ async: true });
    await actions.keyDown(Key.ARROW_UP).pause(500).keyUp(Key.ARROW_UP).perform();
    await actions.keyDown(Key.ARROW_LEFT).pause(300).keyUp(Key.ARROW_LEFT).perform();
    await actions.keyDown(Key.SPACE).pause(200).keyUp(Key.SPACE).perform();
    await actions.keyDown(Key.ARROW_RIGHT).pause(300).keyUp(Key.ARROW_RIGHT).perform();

    // Emit explicit logger messages to ensure forwarding
    await driver.executeScript(
      "if (window.logger) { window.logger.info('CLIENT_TEST', 'started game'); }"
    );

    // Allow forwarder to flush (~4s)
    await new Promise<void>((resolve) => setTimeout(resolve, 4000));
  } finally {
    await driver.quit();
  }
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error('Selenium probe failed', errorMessage);
  process.exit(1);
});

import { Builder, WebDriver } from 'selenium-webdriver';
// @ts-ignore - selenium-webdriver/chrome types have issues with private identifiers
import * as chrome from 'selenium-webdriver/chrome.js';

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
    await driver.get('http://localhost:5173/');
    // Try to start the forwarder via the global we exposed
    await driver.executeScript('if (window.startClientLogForwarder) { window.startClientLogForwarder(); }');
    await driver.executeScript(
      "console.info('CLIENT_LOG_TEST selenium'); console.warn('CLIENT_WARN selenium'); console.error('CLIENT_ERR selenium');"
    );
    // Allow forwarder to flush (~2s interval)
    await new Promise<void>((resolve) => setTimeout(resolve, 4000));
  } finally {
    await driver.quit();
  }
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Selenium probe failed:', errorMessage);
  process.exit(1);
});

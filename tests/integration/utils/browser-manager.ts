import { chromium, Browser, Page } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    // Set user agent for consistent behavior
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'GeoAsteroids-Test-Bot/1.0'
    });

    return this.page;
  }

  async closePage(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }

  async cleanup(): Promise<void> {
    await this.closePage();
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getCurrentPage(): Page | null {
    return this.page;
  }
}

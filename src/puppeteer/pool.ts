import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { IAuditorMcpConfig } from '../config.js';

const DEFAULT_CONCURRENCY = 3;

export class BrowserLaunchError extends Error {
  constructor(cause: unknown) {
    super(`Browser could not be launched: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'BrowserLaunchError';
  }
}

let browser: Browser | null = null;
let activePages = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(concurrency: number): Promise<void> {
  const limit = Math.max(1, concurrency);

  if (activePages < limit) {
    activePages += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    waiters.push(resolve);
  });

  activePages += 1;
}

function releaseSlot(): void {
  activePages -= 1;

  const next = waiters.shift();

  if (next !== undefined) {
    next();
  }
}

async function launchBrowser(config: IAuditorMcpConfig): Promise<Browser> {
  return puppeteer.launch({
    headless: config.headless as boolean | 'shell',
    executablePath: config.browserPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--ignore-certificate-errors',
    ],
  });
}

export async function getBrowser(config: IAuditorMcpConfig): Promise<Browser> {
  if (browser !== null) {
    return browser;
  }

  browser = await launchBrowser(config);

  return browser;
}

export async function withPage<T>(
  config: IAuditorMcpConfig,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  await acquireSlot(config.concurrency || DEFAULT_CONCURRENCY);

  try {
    let browserInstance: Browser;

    try {
      browserInstance = await getBrowser(config);
    } catch (error) {
      throw new BrowserLaunchError(error);
    }

    const page = await browserInstance.newPage();

    try {
      return await fn(page);
    } finally {
      await page.close();
    }
  } finally {
    releaseSlot();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser !== null) {
    await browser.close();
    browser = null;
  }
}

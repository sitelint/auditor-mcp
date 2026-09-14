import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import puppeteer from 'puppeteer';

const execFileAsync = promisify(execFile);
const CHROME_CHANNELS = ['chrome', 'chrome-beta', 'chrome-canary', 'chrome-dev'] as const;
const BROWSER_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const FIREFOX_COMMANDS = ['firefox', 'firefox-esr'];

export interface BrowserPath {
  path: string;
  browser: 'chrome' | 'firefox';
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(command: string): Promise<string | undefined> {
  try {
    const locator = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execFileAsync(locator, [command]);
    const executablePath = stdout.trim().split(/\r?\n/)[0];

    return executablePath && await pathExists(executablePath) ? executablePath : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveBrowserPath(): Promise<BrowserPath> {
  for (const channel of CHROME_CHANNELS) {
    try {
      const executablePath = await puppeteer.executablePath(channel);

      if (await pathExists(executablePath)) {
        return { path: executablePath, browser: 'chrome' };
      }
    } catch {
      // The channel is not installed on this system.
    }
  }

  for (const command of [...BROWSER_COMMANDS, ...FIREFOX_COMMANDS]) {
    const executablePath = await findOnPath(command);

    if (executablePath !== undefined) {
      return {
        path: executablePath,
        browser: FIREFOX_COMMANDS.includes(command) ? 'firefox' : 'chrome',
      };
    }
  }

  return { path: await puppeteer.executablePath(), browser: 'chrome' };
}

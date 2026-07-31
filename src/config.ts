import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(CURRENT_DIR, '..');

export interface IAuditorMcpConfig {
  browserPath?: string;
  concurrency: number;
  timeout: number;
  headless: boolean;
  bundlePath: string;
  transport: 'stdio' | 'sse';
  port: number;
}

export function loadConfig(): IAuditorMcpConfig {
  return {
    browserPath: process.env['AUDITOR_BROWSER_PATH'] || undefined,
    concurrency: Number.parseInt(process.env['AUDITOR_CONCURRENCY'] || '3', 10),
    timeout: Number.parseInt(process.env['AUDITOR_TIMEOUT'] || '30000', 10),
    headless: process.env['AUDITOR_HEADLESS'] !== 'false',
    bundlePath: resolveBundlePath(),
    transport: (process.env['AUDITOR_TRANSPORT'] as 'stdio' | 'sse') || 'stdio',
    port: Number.parseInt(process.env['AUDITOR_PORT'] || '3100', 10),
  };
}

function resolveBundlePath(): string {
  const candidates = [
    join(PROJECT_ROOT, 'vendor', 'auditor.bundle.js'),
    join(PROJECT_ROOT, 'node_modules', '@sitelint', 'auditor', 'dist', 'auditor.bundle.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const bundled = join(PROJECT_ROOT, 'vendor', 'auditor.bundle.js');
  if (!existsSync(bundled)) {
    throw new Error(
      `auditor.bundle.js not found. Run: cp <auditor-repo>/dist/auditor.bundle.js ${bundled}`
    );
  }

  return bundled;
}

export function parseCliArgs(args: string[]): Partial<IAuditorMcpConfig> {
  const config: Partial<IAuditorMcpConfig> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;

    switch (arg) {
      case '--browser':
        config.browserPath = args[i + 1] as string;
        i += 1;
        break;
      case '--concurrency':
        config.concurrency = Number.parseInt(args[i + 1] as string, 10);
        i += 1;
        break;
      case '--timeout':
        config.timeout = Number.parseInt(args[i + 1] as string, 10);
        i += 1;
        break;
      case '--headless':
        config.headless = args[i + 1] !== 'false';
        i += 1;
        break;
      case '--bundle':
        config.bundlePath = args[i + 1] as string;
        i += 1;
        break;
      case '--transport':
        config.transport = args[i + 1] as 'stdio' | 'sse';
        i += 1;
        break;
      case '--port':
        config.port = Number.parseInt(args[i + 1] as string, 10);
        i += 1;
        break;
      default:
        break;
    }
  }

  return config;
}

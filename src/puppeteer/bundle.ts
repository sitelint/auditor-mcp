import { readFileSync } from 'node:fs';
import type { IAuditorMcpConfig } from '../config.js';

export function loadAuditorBundle(config: IAuditorMcpConfig): string {
  return readFileSync(config.bundlePath, 'utf-8');
}

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from './src/puppeteer/pool.js';
import { resolveBrowserPath } from './src/puppeteer/browser-path.js';
import type { IAuditorMcpConfig } from './src/config.js';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

async function main() {
  const browserInfo = await resolveBrowserPath();
  const config: IAuditorMcpConfig = {
    browserPath: browserInfo.path,
    browser: browserInfo.browser,
    timeout: 30000,
    headless: true,
    concurrency: 2,
    bundlePath: join(CURRENT_DIR, 'vendor', 'auditor.bundle.js'),
    transport: 'stdio',
    port: 3100,
  };
  const browser = await getBrowser(config);
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('PAGE:', msg.text()));

  try {
    await page.setBypassCSP(true);
    await page.goto('https://w3c.github.io/wai-tutorials/', { waitUntil: 'networkidle2', timeout: 30000 });

    const bundle = await readFile(config.bundlePath, 'utf-8');
    await page.addScriptTag({ content: bundle });

    // Wait a bit for initialization
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1000)));

    // Test: run audit with wcagCriteria: ['1.1.1'] filter
    const result = await page.evaluate(async () => {
      const auditor = (globalThis as Record<string, unknown>).auditor as any;

      const filterConfig = {
        asyncRunner: false,
        standards: ['wcag'],
        wcagLevels: ['A'],
        wcagCriteria: ['1.1.1'],
      };

      console.log(`Config keys: ${Object.keys(filterConfig).join(', ')}`);

      const auditResult: any = await auditor.config(filterConfig).run();

      const rules = auditResult.rules as Record<string, any>;
      const criterionSet = new Set<string>();

      for (const ruleKey of Object.keys(rules)) {
        const rule = rules[ruleKey];
        const sm = rule.standardMetaData;
        const num = sm?.config?.num;
        const status = rule?.status?.type;

        if (status === 'error') {
          criterionSet.add(num || 'NO_NUM');
        }
      }

      const criteria = [...criterionSet].sort();
      const ruleCount = Object.keys(rules).length;
      const errorCount = Object.values(rules).filter((r: any) => r?.status?.type === 'error').length;

      return {
        ruleCount,
        errorCount,
        criteria,
        score: auditResult.score
      };
    });

    console.log('Result:');
    console.log('  Rules total:', result.ruleCount);
    console.log('  Rules with errors:', result.errorCount);
    console.log('  Score:', result.score);
    console.log(`  Distinct criteria with violations (${result.criteria.length}):`, result.criteria);

  } finally {
    await page.close().catch(() => {});
    await closeBrowser();
  }
}

main().catch(console.error);

import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { IAuditorMcpConfig } from '../config.js';
import { withPage, BrowserLaunchError } from '../puppeteer/pool.js';
import { loadAuditorBundle } from '../puppeteer/bundle.js';
import { formatAuditReport } from '../transforms/report-format.js';
import { storeReport } from '../resources/report-store.js';
import { buildAuditorConfig } from './filter-schema.js';

export function registerAuditHtmlTool(server: McpServer, config: IAuditorMcpConfig): void {
  server.registerTool(
    'audit_html',
    {
      description: 'Audit raw HTML snippet against WCAG/SEO standards. Creates a sandbox page to analyze the markup.',
      inputSchema: z.object({
        html: z.string(),
        waitUntil: z.enum(['load', 'domcontentloaded']).optional().default('load'),
        standards: z.array(z.enum(['wcag', 'sitelint'])),
        auditTypes: z.array(z.enum(['accessibility', 'performance', 'security', 'seo'])),
        wcagLevels: z.array(z.enum(['A', 'AA', 'AAA', 'best_practices'])),
        wcagVersions: z.array(z.enum(['2.0', '2.1', '2.2'])),
        wcagCriteria: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)),
      }),
    },
    async ({ html, standards, auditTypes, wcagLevels, wcagVersions, wcagCriteria, waitUntil }) => {
      try {
        return await withPage(config, async (page) => {
          await page.setBypassCSP(true);
          await page.setContent(html, { waitUntil: waitUntil as 'load' | 'domcontentloaded', timeout: config.timeout });

          const bundle = loadAuditorBundle(config);

          await page.addScriptTag({ content: bundle });

          const auditorConfig = buildAuditorConfig({ standards, auditTypes, wcagLevels, wcagVersions, wcagCriteria });

          const result = await page.evaluate(async (cfg: Record<string, unknown>) => {
            try {
              const auditor = (globalThis as Record<string, unknown>)['auditor'] as {
                config: (opts: Record<string, unknown>) => { run: () => Promise<Record<string, unknown>> };
              };

              const results = await auditor
                .config(cfg)
                .run();

              return { report: results };
            } catch (error) {
              return {
                report: {},
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }, auditorConfig);

          const reportId = storeReport(result, 'inline-html');
          const formatted = await formatAuditReport(result);

          const text = [
            '## HTML Snippet Audit',
            '',
            formatted.summary,
            '',
            `Report ID: ${reportId}`,
            `Resource: auditor://report/${reportId}`,
            '',
            'Full JSON report available via resource link above.',
          ].join('\n');

          return {
            content: [{ type: 'text', text }],
          };
        });
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);

        if (error instanceof BrowserLaunchError) {
          return {
            content: [{ type: 'text', text: `Audit failed to start: ${message}. Puppeteer manages the browser installation automatically.` }],
          };
        }

        if (message.toLowerCase().includes('timeout')) {
          return {
            content: [{ type: 'text', text: `HTML audit aborted: the page did not finish loading within ${config.timeout} ms. External resources may be hanging. Retry with waitUntil: "domcontentloaded" or ensure all referenced assets respond.` }],
          };
        }

        return {
          content: [{ type: 'text', text: `HTML audit failed: could not render the provided markup (${message}).` }],
        };
      }
    }
  );
}

import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { IAuditorMcpConfig } from '../config.js';
import { injectAndRunAudit } from '../puppeteer/injector.js';
import { formatAuditReport } from '../transforms/report-format.js';
import { storeReport } from '../resources/report-store.js';
import { withPage, BrowserLaunchError } from '../puppeteer/pool.js';

export function registerCheckCriterionTool(server: McpServer, config: IAuditorMcpConfig): void {
  server.registerTool(
    'check_wcag_criterion',
    {
      description: 'Check a single WCAG success criterion against a page. Filters audit to one criterion, level, and WCAG standard — faster than full audit. Returns pass/fail per element.',
      inputSchema: z.object({
        url: z.string().url(),
        criterion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be WCAG criterion number, e.g. 1.1.1, 1.4.3'),
        level: z.enum(['A', 'AA', 'AAA']).optional().default('AA'),
      }),
    },
    async ({ url, criterion, level }) => {
      try {
        return await withPage(config, async (page) => {
          const result = await injectAndRunAudit(
            page,
            config,
            url,
            { waitUntil: 'networkidle2' },
            {
              standards: ['wcag'],
              wcagLevels: [level],
              wcagCriteria: [criterion],
            }
          );

          const reportId = storeReport(result, `${url}#${criterion}`);
          const formatted = await formatAuditReport(result);

          const summaryLines: string[] = [];

          summaryLines.push(`## Criterion Check: SC ${criterion} (Level ${level})`);
          summaryLines.push(`URL: ${url}`);
          summaryLines.push('');

          if (result.error) {
            summaryLines.push(`Audit failed: ${result.error}`);
          } else if (formatted.ruleCount.violations === 0) {
            summaryLines.push('✅ No violations found for this criterion.');
            summaryLines.push('');
            summaryLines.push('All applicable rules passed.');
          } else {
            summaryLines.push(formatted.summary);
            summaryLines.push('');
            summaryLines.push(`Report ID: ${reportId}`);
            summaryLines.push(`Resource: auditor://report/${reportId}`);
            summaryLines.push('');
            summaryLines.push('Full JSON report available via resource link above.');
          }

          return {
            content: [{ type: 'text', text: summaryLines.join('\n') }],
          };
        });
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);

        if (error instanceof BrowserLaunchError) {
          return {
            content: [{ type: 'text', text: `Audit failed to start: ${message}. Puppeteer manages the browser installation automatically.` }],
          };
        }

        return {
          content: [{ type: 'text', text: `Criterion check failed unexpectedly: ${message}` }],
        };
      }
    }
  );
}

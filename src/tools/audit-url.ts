import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { IAuditorMcpConfig } from '../config.js';
import { injectAndRunAudit } from '../puppeteer/injector.js';
import { formatAuditReport } from '../transforms/report-format.js';
import { storeReport } from '../resources/report-store.js';
import { withPage, BrowserLaunchError } from '../puppeteer/pool.js';
import { filterFields } from './filter-schema.js';

export function registerAuditUrlTool(server: McpServer, config: IAuditorMcpConfig): void {
  server.registerTool(
    'audit_url',
    {
      description: 'Run a SiteLint audit on a live URL. Checks WCAG accessibility, SEO, performance, and security. Optionally filter by standard, audit type, WCAG level, version, or specific success criteria.',
      inputSchema: z.object({
        url: z.string().url(),
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional().default('networkidle2'),
        ...filterFields,
      }),
    },
    async ({ url, waitUntil, standards, auditTypes, wcagLevels, wcagVersions, wcagCriteria }) => {
      try {
        return await withPage(config, async (page) => {
          const result = await injectAndRunAudit(
            page,
            config,
            url,
            { waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' },
            { standards, auditTypes, wcagLevels, wcagVersions, wcagCriteria }
          );

          const reportId = storeReport(result, url);
          const formatted = await formatAuditReport(result);

          const text = [
            `## Audit Report: ${url}`,
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

        return {
          content: [{ type: 'text', text: `Audit failed unexpectedly: ${message}` }],
        };
      }
    }
  );
}

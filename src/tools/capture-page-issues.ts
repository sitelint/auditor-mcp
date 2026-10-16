import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { IAuditorMcpConfig } from '../config.js';
import { withPage } from '../puppeteer/pool.js';
import { loadAuditorBundle } from '../puppeteer/bundle.js';

const COLLECTOR_KEYS = [
  'browserReports',
  'consoleErrors',
  'consoleWarnings',
  'network',
  'pageLoad',
  'resources',
  'userEvents',
] as const;

export function registerCapturePageIssuesTool(server: McpServer, config: IAuditorMcpConfig): void {
  server.registerTool(
    'capture_page_issues',
    {
      description: 'Load a page with Puppeteer, inject the SiteLint auditor with runtime issue collection enabled, wait, and return captured issues inline. No platform account required — works fully offline.',
      inputSchema: z.object({
        url: z.string().url(),
        waitMs: z.number().int().positive().max(60000).optional().default(5000).describe('Milliseconds to wait after page load before collecting issues.'),
        collectors: z
          .object({
            browserReports: z.boolean().optional(),
            consoleErrors: z.boolean().optional(),
            consoleWarnings: z.boolean().optional(),
            network: z.boolean().optional(),
            pageLoad: z.boolean().optional(),
            resources: z.boolean().optional(),
            userEvents: z.boolean().optional(),
          })
          .optional()
          .describe('Which issue collectors to enable. If omitted, all collectors are enabled.'),
      }),
    },
    async ({ url, waitMs = 5000, collectors }) => {
      try {
        return await withPage(config, async (page) => {
          await page.setBypassCSP(true);
          await page.goto(url, { waitUntil: 'networkidle2', timeout: config.timeout });

          const bundle = loadAuditorBundle(config);

          await page.addScriptTag({ content: bundle });

          const issueCollectors: Record<string, boolean> = {};

          if (collectors !== undefined) {
            for (const key of COLLECTOR_KEYS) {
              const value = collectors[key as keyof typeof collectors];

              if (typeof value === 'boolean') {
                issueCollectors[key] = value;
              }
            }
          }

          const auditorConfig: Record<string, unknown> = {
            asyncRunner: false,
            collectIssues: true,
            issuesTransport: 'local',
            issueCollectors,
          };

          try {
            await page.evaluate(async (cfg: Record<string, unknown>) => {
              const auditor = (globalThis as Record<string, unknown>).auditor as {
                config: (opts: Record<string, unknown>) => { run: () => Promise<unknown> };
                getIssues: () => unknown[];
              };

              await auditor.config(cfg).run();
            }, auditorConfig);
          } catch (error) {
            // run() may reject if the validator throws; collectors are already initialized,
            // so we can still fetch captured issues.
            console.error('[capture_page_issues] auditor.run() threw:', error);
          }

          // Wait for runtime issues to surface (JS errors, network failures, etc.).
          await new Promise((resolve): void => {
            globalThis.setTimeout(resolve, waitMs);
          });

          const issues: unknown[] = await page.evaluate((): unknown[] => {
            const auditor = (globalThis as Record<string, unknown>).auditor as {
              getIssues: () => unknown[];
            };

            if (typeof auditor.getIssues !== 'function') {
              return [];
            }

            return auditor.getIssues();
          });

          const trimmedIssues: Array<{
            issueId: string;
            ts: string;
            type: string;
            severity: string;
            pageUrl: string;
            message: string;
            fingerprint: string;
            count: number;
            stack?: string;
            userEventsLog?: unknown[];
            details?: unknown;
          }> = [];

          for (const issue of issues) {
            const typed = issue as {
              issueId?: string;
              lastSeenAt?: string;
              type?: string;
              severity?: string;
              pageUrl?: string;
              message?: string;
              fingerprint?: string;
              count?: number;
              userEventsLog?: unknown[];
              details?: unknown;
              stack?: string;
            };

            const trimmed: {
              issueId: string;
              ts: string;
              type: string;
              severity: string;
              pageUrl: string;
              message: string;
              fingerprint: string;
              count: number;
              stack?: string;
              userEventsLog?: unknown[];
              details?: unknown;
            } = {
              issueId: typed.issueId ?? '',
              ts: typed.lastSeenAt ?? '',
              type: typed.type ?? '',
              severity: typed.severity ?? '',
              pageUrl: typed.pageUrl ?? '',
              message: typed.message ?? '',
              fingerprint: typed.fingerprint ?? '',
              count: typeof typed.count === 'number' ? typed.count : 0,
            };

            if (typed.stack) {
              trimmed.stack = typed.stack;
            }

            if (typed.userEventsLog) {
              trimmed.userEventsLog = typed.userEventsLog;
            }

            if (typed.details) {
              trimmed.details = typed.details;
            }

            trimmedIssues.push(trimmed);
          }

          const lines: string[] = [
            `## Captured Issues: ${url}`,
            `Waited: ${waitMs}ms`,
            `Issues found: ${trimmedIssues.length}`,
            '',
          ];

          for (const issue of trimmedIssues) {
            lines.push(
              `- ${issue.ts} | ${issue.severity} | ${issue.type} | ${issue.pageUrl}`,
              `  fingerprint: ${issue.fingerprint} | count: ${issue.count}`,
              `  message: ${issue.message}`,
              `  issueId: ${issue.issueId}`,
              '',
            );
          }

          return {
            content: [{ type: 'text', text: lines.join('\n') }],
            structuredContent: { url, waitMs, issues: trimmedIssues, count: trimmedIssues.length },
          };
        });
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);

        return {
          content: [{ type: 'text', text: `capture_page_issues failed unexpectedly: ${message}` }],
        };
      }
    }
  );
}

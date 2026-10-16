import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { IAuditorMcpConfig } from '../config.js';

const ISSUE_TYPES = [
  'js_error',
  'unhandled_rejection',
  'console_error',
  'console_warning',
  'network_failure',
  'resource_error',
  'browser_report',
  'page_load',
] as const;

const SEVERITIES = ['error', 'warning', 'info'] as const;

export function registerListIssuesTool(server: McpServer, config: IAuditorMcpConfig): void {
  server.registerTool(
    'list_issues',
    {
      description: 'List recent runtime issues captured by the SiteLint auditor for a site. Returns trimmed fields (issueId, ts, type, severity, pageUrl, message, fingerprint, count). This is the "go find what I just hit" call.',
      inputSchema: z.object({
        siteApiToken: z.string().min(1, 'siteApiToken is required'),
        minutes: z.number().int().positive().optional().describe('Only return issues seen within the last N minutes.'),
        types: z.array(z.enum(ISSUE_TYPES)).optional().describe('Filter by issue type.'),
        severity: z.enum(SEVERITIES).optional().describe('Filter by severity.'),
        limit: z.number().int().positive().max(100).optional().default(20).describe('Maximum number of issues to return.'),
      }),
    },
    async ({ siteApiToken, minutes, types, severity, limit = 20 }) => {
      try {
        const query = new URLSearchParams();

        if (typeof minutes === 'number' && minutes > 0) {
          const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
          query.set('since', since);
        }

        if (Array.isArray(types) && types.length > 0) {
          query.set('types', types.join(','));
        }

        if (typeof severity === 'string') {
          query.set('severity', severity);
        }

        query.set('limit', String(limit));

        const url = `${config.platformUrl}/api/v1/issues/${encodeURIComponent(siteApiToken)}?${query.toString()}`;

        const headers: HeadersInit = { Accept: 'application/json' };

        if (config.accessToken !== null && config.accessToken.length > 0) {
          headers.Authorization = `Bearer ${config.accessToken}`;
        }

        const response = await globalThis.fetch(url, { headers });

        if (!response.ok) {
          const body = await response.text().catch(() => '');

          return {
            content: [
              {
                type: 'text',
                text: `list_issues failed: HTTP ${response.status}${body.length > 0 ? ` - ${body}` : ''}`,
              },
            ],
          };
        }

        const data: { issues: unknown[]; _total: number } = await response.json();

        const issues: Array<{ issueId: string; ts: string; type: string; severity: string; pageUrl: string; message: string; fingerprint: string; count: number }> = (
          Array.isArray(data.issues) ? data.issues : []
        ).map((issue: unknown): { issueId: string; ts: string; type: string; severity: string; pageUrl: string; message: string; fingerprint: string; count: number } => {
          const typed = issue as {
            issueId?: string;
            lastSeenAt?: string;
            type?: string;
            severity?: string;
            pageUrl?: string;
            message?: string;
            fingerprint?: string;
            count?: number;
          };

          return {
            issueId: typed.issueId ?? '',
            ts: typed.lastSeenAt ?? '',
            type: typed.type ?? '',
            severity: typed.severity ?? '',
            pageUrl: typed.pageUrl ?? '',
            message: typed.message ?? '',
            fingerprint: typed.fingerprint ?? '',
            count: typeof typed.count === 'number' ? typed.count : 0,
          };
        });

        const lines: string[] = [
          `## Issues for ${siteApiToken}`,
          `Total: ${data._total ?? 0}, returned: ${issues.length}`,
          '',
        ];

        for (const issue of issues) {
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
          structuredContent: { issues, _total: data._total },
        };
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);

        return {
          content: [{ type: 'text', text: `list_issues failed unexpectedly: ${message}` }],
        };
      }
    }
  );
}

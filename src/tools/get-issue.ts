import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { IAuditorMcpConfig } from '../config.js';

export function registerGetIssueTool(server: McpServer, config: IAuditorMcpConfig): void {
  server.registerTool(
    'get_issue',
    {
      description: 'Get full detail for a single issue group: stack trace, user events log (steps to reproduce), network context, and console tail.',
      inputSchema: z.object({
        siteApiToken: z.string().min(1, 'siteApiToken is required'),
        groupId: z.string().min(1, 'groupId is required'),
      }),
    },
    async ({ siteApiToken, groupId }) => {
      try {
        const url = `${config.platformUrl}/api/v1/issues/${encodeURIComponent(siteApiToken)}/groups/${encodeURIComponent(groupId)}`;

        const headers: HeadersInit = { Accept: 'application/json' };

        if (config.accessToken !== null && config.accessToken.length > 0) {
          headers.Authorization = `Bearer ${config.accessToken}`;
        }

        const response = await globalThis.fetch(url, { headers });

        if (!response.ok) {
          const body = await response.text().catch(() => '');

          if (response.status === 404) {
            return {
              content: [{ type: 'text', text: `Issue group not found: ${groupId}` }],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `get_issue failed: HTTP ${response.status}${body.length > 0 ? ` - ${body}` : ''}`,
              },
            ],
          };
        }

        const data: { group: unknown; sampleIssue: unknown } = await response.json();

        const lines: string[] = [
          `## Issue Group: ${groupId}`,
          '',
        ];

        const group = data.group as {
          fingerprint?: string;
          type?: string;
          message?: string;
          url?: string;
          count?: number;
          firstSeenAt?: string;
          lastSeenAt?: string;
          status?: string;
        } | null;

        if (group !== null) {
          lines.push(
            `**Type:** ${group.type ?? ''}`,
            `**Severity:** n/a (group level)`,
            `**Message:** ${group.message ?? ''}`,
            `**URL:** ${group.url ?? ''}`,
            `**Count:** ${group.count ?? 0}`,
            `**First seen:** ${group.firstSeenAt ?? ''}`,
            `**Last seen:** ${group.lastSeenAt ?? ''}`,
            `**Status:** ${group.status ?? ''}`,
            `**Fingerprint:** ${group.fingerprint ?? ''}`,
            '',
          );
        }

        const sampleIssue = data.sampleIssue as {
          stack?: string;
          userEventsLog?: Array<{ category?: string; label?: string; occurredAt?: string; targetSelector?: string }>;
          details?: unknown;
          context?: { consoleTail?: Array<{ level?: string; message?: string; occurredAt?: string }> };
        } | null;

        if (sampleIssue !== null) {
          lines.push('## Sample Issue Detail', '');

          if (typeof sampleIssue.stack === 'string' && sampleIssue.stack.length > 0) {
            lines.push('### Stack', '```', sampleIssue.stack, '```', '');
          }

          if (Array.isArray(sampleIssue.userEventsLog) && sampleIssue.userEventsLog.length > 0) {
            lines.push('### Steps to Reproduce (User Events Log)', '');

            for (const event of sampleIssue.userEventsLog) {
              lines.push(
                `- ${event.occurredAt ?? ''} | ${event.category ?? ''} | ${event.label ?? ''}${
                  event.targetSelector ? ` | ${event.targetSelector}` : ''
                }`,
              );
            }

            lines.push('');
          }

          if (sampleIssue.details !== undefined) {
            lines.push('### Context Details', '```', JSON.stringify(sampleIssue.details, null, 2), '```', '');
          }

          const consoleTail = sampleIssue.context?.consoleTail;

          if (Array.isArray(consoleTail) && consoleTail.length > 0) {
            lines.push('### Console Tail', '');

            for (const entry of consoleTail) {
              lines.push(`- ${entry.level ?? ''}: ${entry.message ?? ''} @ ${entry.occurredAt ?? ''}`);
            }

            lines.push('');
          }
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: data,
        };
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);

        return {
          content: [{ type: 'text', text: `get_issue failed unexpectedly: ${message}` }],
        };
      }
    }
  );
}

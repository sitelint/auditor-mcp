import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import type { IAuditResult } from '../puppeteer/injector.js';
import { formatAuditReport } from '../transforms/report-format.js';

interface IReportEntry {
  id: string;
  result: IAuditResult;
  url: string;
  timestamp: number;
}

const MAX_REPORTS = 50;
const reports: Map<string, IReportEntry> = new Map();
let counter = 0;

export function storeReport(result: IAuditResult, url: string): string {
  const id = `report_${++counter}`;

  if (reports.size >= MAX_REPORTS) {
    const oldest = reports.keys().next().value as string;
    reports.delete(oldest);
  }

  reports.set(id, { id, result, url, timestamp: Date.now() });
  return id;
}

export function getReport(id: string): IReportEntry | undefined {
  return reports.get(id);
}

export function registerReportResources(server: McpServer): void {
  server.registerResource(
    'auditor-report',
    new ResourceTemplate('auditor://report/{id}', { list: undefined }),
    {
      description: 'Full audit report by ID',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      const report = getReport(id as string);

      if (report === undefined) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: `Report "${id as string}" not found` }),
            },
          ],
        };
      }

      const formatted = await formatAuditReport(report.result);

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                id: report.id,
                url: report.url,
                timestamp: report.timestamp,
                summary: formatted.summary,
                details: formatted.details,
                raw: report.result.report,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

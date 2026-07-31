import { McpServer } from '@modelcontextprotocol/server';
import type { IAuditorMcpConfig } from './config.js';
import { registerAuditUrlTool } from './tools/audit-url.js';
import { registerAuditHtmlTool } from './tools/audit-html.js';
import { registerCheckCriterionTool } from './tools/check-criterion.js';
import { registerReportResources } from './resources/report-store.js';
import { registerStandardsResources } from './resources/standards.js';

export function createServer(config: IAuditorMcpConfig): McpServer {
  const server = new McpServer({
    name: 'sitelint-auditor',
    version: '0.1.0',
  });

  registerAuditUrlTool(server, config);
  registerAuditHtmlTool(server, config);
  registerCheckCriterionTool(server, config);
  registerReportResources(server);
  registerStandardsResources(server);

  return server;
}

import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import type { IAuditorMcpConfig } from './config.js';
import { registerAuditUrlTool } from './tools/audit-url.js';
import { registerAuditHtmlTool } from './tools/audit-html.js';
import { registerCheckCriterionTool } from './tools/check-criterion.js';
import { registerReportResources } from './resources/report-store.js';
import { registerStandardsResources } from './resources/standards.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export function createServer(config: IAuditorMcpConfig): McpServer {
  const server = new McpServer({
    name: 'sitelint-auditor',
    version,
  });

  registerAuditUrlTool(server, config);
  registerAuditHtmlTool(server, config);
  registerCheckCriterionTool(server, config);
  registerReportResources(server);
  registerStandardsResources(server);

  return server;
}

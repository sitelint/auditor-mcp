import type { Page } from 'puppeteer';
import { loadAuditorBundle } from './bundle.js';
import type { IAuditorMcpConfig } from '../config.js';

export interface IAuditOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

export interface IAuditFilterOptions {
  standards?: string[];
  auditTypes?: string[];
  wcagLevels?: string[];
  wcagVersions?: string[];
  wcagCriteria?: string[];
}

export interface IAuditResult {
  report: Record<string, unknown>;
  error?: string;
}

export async function injectAndRunAudit(
  page: Page,
  config: IAuditorMcpConfig,
  url: string,
  options: IAuditOptions = {},
  filters?: IAuditFilterOptions
): Promise<IAuditResult> {
  const waitUntil = options.waitUntil || 'networkidle2';

  try {
    await page.setBypassCSP(true);
    await page.goto(url, { waitUntil, timeout: config.timeout });
  } catch (error) {
    const message: string = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes('timeout')) {
      return {
        report: {},
        error: `Navigation timed out after ${config.timeout} ms. The page may be slow or blocking ${waitUntil}. Retry with waitUntil: "load" or "domcontentloaded".`,
      };
    }

    return {
      report: {},
      error: `Failed to load URL ${url}: ${message}`,
    };
  }

  const bundle = loadAuditorBundle(config);

  try {
    await page.addScriptTag({ content: bundle });
  } catch (error) {
    return {
      report: {},
      error: `Failed to inject auditor script: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const auditorConfig: Record<string, unknown> = { asyncRunner: false };

  if (filters !== undefined) {
    if (Array.isArray(filters.standards) && filters.standards.length > 0) {
      auditorConfig['standards'] = filters.standards;
    }

    if (Array.isArray(filters.auditTypes) && filters.auditTypes.length > 0) {
      auditorConfig['auditTypes'] = filters.auditTypes;
    }

    if (Array.isArray(filters.wcagLevels) && filters.wcagLevels.length > 0) {
      auditorConfig['wcagLevels'] = filters.wcagLevels;
    }

    if (Array.isArray(filters.wcagVersions) && filters.wcagVersions.length > 0) {
      auditorConfig['wcagVersions'] = filters.wcagVersions;
    }

    if (Array.isArray(filters.wcagCriteria) && filters.wcagCriteria.length > 0) {
      auditorConfig['wcagCriteria'] = filters.wcagCriteria;
    }
  }

  let result: IAuditResult;

  try {
    result = await page.evaluate(async (cfg: Record<string, unknown>) => {
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
  } catch (error) {
    return {
      report: {},
      error: `Auditor evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return result;
}

import * as z from 'zod/v4';
import type { IAuditFilterOptions } from '../puppeteer/injector.js';

export const filterFields = {
  standards: z.array(z.enum(['wcag', 'sitelint'])).optional(),
  auditTypes: z.array(z.enum(['accessibility', 'performance', 'security', 'seo'])).optional(),
  wcagLevels: z.array(z.enum(['A', 'AA', 'AAA', 'best_practices'])).optional(),
  wcagVersions: z.array(z.enum(['2.0', '2.1', '2.2'])).optional(),
  wcagCriteria: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)).optional(),
};

export function buildAuditorConfig(filters?: IAuditFilterOptions): Record<string, unknown> {
  const config: Record<string, unknown> = { asyncRunner: false };

  if (filters === undefined) {
    return config;
  }

  if (Array.isArray(filters.standards) && filters.standards.length > 0) {
    config.standards = filters.standards;
  }

  if (Array.isArray(filters.auditTypes) && filters.auditTypes.length > 0) {
    config.auditTypes = filters.auditTypes;
  }

  if (Array.isArray(filters.wcagLevels) && filters.wcagLevels.length > 0) {
    config.wcagLevels = filters.wcagLevels;
  }

  if (Array.isArray(filters.wcagVersions) && filters.wcagVersions.length > 0) {
    config.wcagVersions = filters.wcagVersions;
  }

  if (Array.isArray(filters.wcagCriteria) && filters.wcagCriteria.length > 0) {
    config.wcagCriteria = filters.wcagCriteria;
  }

  return config;
}

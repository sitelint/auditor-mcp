import { describe, expect, it } from 'vitest';
import { buildAuditorConfig } from './filter-schema.js';
import type { IAuditFilterOptions } from '../puppeteer/injector.js';

describe('buildAuditorConfig', () => {
  it('returns asyncRunner false when filters are undefined', () => {
    expect(buildAuditorConfig(undefined)).toEqual({ asyncRunner: false });
  });

  it('returns asyncRunner false when all filter arrays are empty', () => {
    const filters: IAuditFilterOptions = {};
    expect(buildAuditorConfig(filters)).toEqual({ asyncRunner: false });
  });

  it('includes only the provided filter fields', () => {
    const filters: IAuditFilterOptions = {
      standards: ['wcag'],
      wcagCriteria: ['1.1.1'],
    };

    expect(buildAuditorConfig(filters)).toEqual({
      asyncRunner: false,
      standards: ['wcag'],
      wcagCriteria: ['1.1.1'],
    });
  });

  it('includes every filter field when all are provided', () => {
    const filters: IAuditFilterOptions = {
      standards: ['wcag', 'sitelint'],
      auditTypes: ['accessibility', 'seo'],
      wcagLevels: ['A', 'AA'],
      wcagVersions: ['2.1', '2.2'],
      wcagCriteria: ['1.1.1', '1.4.3'],
    };

    expect(buildAuditorConfig(filters)).toEqual({
      asyncRunner: false,
      standards: ['wcag', 'sitelint'],
      auditTypes: ['accessibility', 'seo'],
      wcagLevels: ['A', 'AA'],
      wcagVersions: ['2.1', '2.2'],
      wcagCriteria: ['1.1.1', '1.4.3'],
    });
  });

  it('ignores empty arrays', () => {
    const filters: IAuditFilterOptions = {
      standards: [],
      wcagLevels: ['A'],
    };

    expect(buildAuditorConfig(filters)).toEqual({
      asyncRunner: false,
      wcagLevels: ['A'],
    });
  });
});

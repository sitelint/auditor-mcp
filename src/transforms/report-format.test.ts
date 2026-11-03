import { describe, expect, it } from 'vitest';
import { formatAuditReport } from './report-format.js';
import type { IAuditResult } from '../puppeteer/injector.js';

function makeRule(overrides: {
  statusType: string;
  criterionNum?: string;
  criterionTitle?: string;
  level?: string;
  severity?: string;
  title?: string;
  manual?: boolean;
  resultCount?: number;
}): Record<string, unknown> {
  const rule: Record<string, unknown> = {
    status: { type: overrides.statusType },
    title: overrides.title ?? 'Rule Title',
    severity: overrides.severity ?? 'high',
  };

  if (overrides.statusType === 'error' && overrides.criterionNum !== undefined) {
    rule.standardMetaData = {
      config: {
        num: overrides.criterionNum,
        title: overrides.criterionTitle ?? 'Non-WCAG Issues',
        level: overrides.level ?? '',
      },
    };

    const results: Array<Record<string, unknown>> = [];
    const resultCount = overrides.resultCount ?? 1;

    for (let i = 0; i < resultCount; i += 1) {
      results.push({
        messageTranslation: [
          { messageTranslationId: `msg-${overrides.criterionNum}-${i}` },
        ],
        element: { cssSelector: `div:nth-child(${i + 1})` },
      });
    }

    rule.results = results;
  }

  if (overrides.manual === true) {
    rule.manual = true;
  }

  return rule;
}

describe('formatAuditReport', () => {
  it('returns an error summary when the result has an error', async () => {
    const result: IAuditResult = {
      report: {},
      error: 'Navigation timed out after 30000 ms.',
    };

    const formatted = await formatAuditReport(result);

    expect(formatted.summary).toContain(
      'Audit failed: Navigation timed out after 30000 ms.',
    );
    expect(formatted.ruleCount).toEqual({
      violations: 0,
      passed: 0,
      skipped: 0,
      manualChecks: 0,
    });
    expect(formatted.totalViolations).toBe(0);
    expect(formatted.truncated).toBe(false);
  });

  it('returns zero counts for a report with no rules', async () => {
    const result: IAuditResult = { report: { score: 100 } };

    const formatted = await formatAuditReport(result);

    expect(formatted.summary).toContain('Score: 100');
    expect(formatted.ruleCount).toEqual({
      violations: 0,
      passed: 0,
      skipped: 0,
      manualChecks: 0,
    });
    expect(formatted.totalViolations).toBe(0);
    expect(formatted.shownViolations).toBe(0);
    expect(formatted.truncated).toBe(false);
  });

  it('groups violations by criterion and sorts them ascending', async () => {
    const report: Record<string, unknown> = {
      score: 85,
      rules: {
        'rule-a': makeRule({
          statusType: 'error',
          criterionNum: '1.4.3',
          criterionTitle: 'Contrast (Minimum)',
          level: 'AA',
          severity: 'high',
          resultCount: 2,
        }),
        'rule-b': makeRule({
          statusType: 'error',
          criterionNum: '1.1.1',
          criterionTitle: 'Non-text Content',
          level: 'A',
          severity: 'critical',
          resultCount: 1,
        }),
        'rule-c': makeRule({ statusType: 'passed' }),
      },
    };

    const formatted = await formatAuditReport({ report });

    expect(formatted.ruleCount.violations).toBe(3);
    expect(formatted.ruleCount.passed).toBe(1);
    expect(formatted.totalViolations).toBe(3);

    const lines = formatted.summary.split('\n');
    const criterionLines = lines.filter((line) => line.startsWith('  1.'));
    expect(criterionLines.length).toBeGreaterThanOrEqual(1);
    expect(criterionLines[0]).toContain('1.1.1');
  });

  it('counts manual checks and passed rules separately', async () => {
    const report: Record<string, unknown> = {
      score: 90,
      rules: {
        'rule-manual': makeRule({ statusType: 'error', manual: true }),
        'rule-passed': makeRule({ statusType: 'passed' }),
      },
    };

    const formatted = await formatAuditReport({ report });

    expect(formatted.ruleCount.manualChecks).toBe(1);
    expect(formatted.ruleCount.passed).toBe(1);
    expect(formatted.ruleCount.violations).toBe(0);
    expect(formatted.totalViolations).toBe(0);
  });

  it('truncates violations beyond the maximum shown limit', async () => {
    const rules: Record<string, Record<string, unknown>> = {};

    for (let i = 0; i < 60; i += 1) {
      rules[`rule-${i}`] = makeRule({
        statusType: 'error',
        criterionNum: '1.1.1',
        criterionTitle: 'Non-text Content',
        level: 'A',
        severity: 'low',
        resultCount: 1,
      });
    }

    const formatted = await formatAuditReport({ report: { score: 50, rules } });

    expect(formatted.ruleCount.violations).toBe(60);
    expect(formatted.shownViolations).toBe(50);
    expect(formatted.truncated).toBe(true);
    expect(formatted.summary).toContain('10 more violations not shown');
  });
});

import { describe, expect, it } from 'vitest';
import { getReport, storeReport } from './report-store.js';
import type { IAuditResult } from '../puppeteer/injector.js';

const emptyResult: IAuditResult = { report: {} };

describe('storeReport / getReport', () => {
  it('stores a report and returns a sequential id', () => {
    const id = storeReport(emptyResult, 'https://example.com/');
    expect(id).toBe('report_1');

    const entry = getReport(id);
    expect(entry).toBeDefined();
    expect(entry?.id).toBe(id);
    expect(entry?.url).toBe('https://example.com/');
    expect(entry?.result).toBe(emptyResult);
    expect(typeof entry?.timestamp).toBe('number');
  });

  it('returns unique ids on repeated calls', () => {
    const first = storeReport(emptyResult, 'https://first.example/');
    const second = storeReport(emptyResult, 'https://second.example/');

    expect(second).not.toBe(first);
    expect(getReport(first)).toBeDefined();
    expect(getReport(second)).toBeDefined();
  });

  it('returns undefined for an unknown id', () => {
    expect(getReport('report_missing')).toBeUndefined();
  });

  it('evicts the oldest report once the limit is exceeded', () => {
    const count = 60;
    const ids: string[] = [];

    for (let i = 0; i < count; i += 1) {
      ids.push(storeReport(emptyResult, `https://example-${i}/`));
    }

    const firstId = ids[0];
    const lastId = ids[count - 1];

    expect(getReport(firstId)).toBeUndefined();
    expect(getReport(lastId)).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './config.js';

describe('parseCliArgs', () => {
  it('returns an empty object for no arguments', () => {
    expect(parseCliArgs([])).toEqual({});
  });

  it('parses a single string option', () => {
    expect(parseCliArgs(['--browser', '/usr/bin/chromium'])).toEqual({
      browserPath: '/usr/bin/chromium',
    });
  });

  it('parses numeric options', () => {
    expect(
      parseCliArgs(['--concurrency', '5', '--port', '3100', '--timeout', '10000']),
    ).toEqual({
      concurrency: 5,
      port: 3100,
      timeout: 10000,
    });
  });

  it('parses the boolean headless option', () => {
    expect(parseCliArgs(['--headless', 'false'])).toEqual({ headless: false });
    expect(parseCliArgs(['--headless', 'true'])).toEqual({ headless: true });
  });

  it('parses the transport option', () => {
    expect(parseCliArgs(['--transport', 'sse'])).toEqual({ transport: 'sse' });
  });

  it('parses multiple options combined', () => {
    expect(
      parseCliArgs([
        '--bundle',
        '/path/to/bundle.js',
        '--platform-url',
        'https://platform.example.com',
      ]),
    ).toEqual({
      bundlePath: '/path/to/bundle.js',
      platformUrl: 'https://platform.example.com',
    });
  });

  it('ignores unknown arguments', () => {
    expect(parseCliArgs(['--unknown', 'value', '--another'])).toEqual({});
  });
});

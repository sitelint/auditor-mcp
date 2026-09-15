# SiteLint Auditor MCP Server

MCP server that runs [SiteLint Auditor](https://www.sitelint.com) - WCAG and SiteLint Best Practices for accessibility, SEO, performance, and security audits via LLM agents.

## Quick start

```bash
npx @sitelint/auditor-mcp
```

Requires Chromium or Chrome. The MCP server automatically detects an installed system
browser. If none is available, Puppeteer normally downloads Chrome during package
installation; if that download was skipped, it downloads Chrome for Testing on the first
audit. No browser path configuration is required.

## Tools

### `audit_url`

Audit a live URL.

```json
{
  "url": "https://example.com",
  "standards": ["wcag"],
  "auditTypes": ["accessibility"],
  "wcagLevels": ["A", "AA"],
  "wcagVersions": ["2.2"],
  "wcagCriteria": []
}
```

### `audit_html`

Audit raw HTML without fetching a URL. Defaults to `waitUntil: "load"` so image-based rules (e.g. oversized images, size calculations) see fully loaded assets. A `timeout` guards against hanging external resources — if the `load` event never fires, the audit aborts with a clear error instead of hanging. Pass `waitUntil: "domcontentloaded"` to skip slow assets entirely.

All filter parameters are **required** — pass empty arrays to skip a filter.

WCAG audit:

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "standards": ["wcag"],
  "auditTypes": ["accessibility"],
  "wcagLevels": ["A", "AA"],
  "wcagVersions": ["2.2"],
  "wcagCriteria": ["1.1.1", "1.4.3"]
}
```

SiteLint best practices (proprietary SEO, performance, security):

```json
{
  "html": "<!DOCTYPE html><html lang=\"en\"><head><title>Test</title></head><body></body></html>",
  "standards": ["sitelint"],
  "auditTypes": ["seo", "performance", "security"],
  "wcagLevels": [],
  "wcagVersions": [],
  "wcagCriteria": []
}
```

Full audit (everything):

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "standards": ["wcag", "sitelint"],
  "auditTypes": ["accessibility", "performance", "security", "seo"],
  "wcagLevels": ["A", "AA", "AAA"],
  "wcagVersions": ["2.0", "2.1", "2.2"],
  "wcagCriteria": []
}
```

### `check_wcag_criterion`

Check a single WCAG criterion against a URL.

```json
{
  "url": "https://example.com",
  "criterion": "1.1.1"
}
```

Returns `pass`/`fail` with violation count.

## Filter parameters

Filters are ANDed — a rule must match every provided filter to run. On `audit_url` filters are optional (omit or pass empty arrays to skip). On `audit_html` all filter parameters are **required** — pass empty arrays to skip.

| Parameter | Values | Example |
| --- | --- | --- |
| `standards` | `wcag`, `sitelint` | `["wcag"]` |
| `auditTypes` | `accessibility`, `performance`, `security`, `seo` | `["accessibility", "seo"]` |
| `wcagLevels` | `A`, `AA`, `AAA`, `best_practices` | `["A", "AA"]` |
| `wcagVersions` | `2.0`, `2.1`, `2.2` | `["2.2"]` |
| `wcagCriteria` | WCAG criterion numbers | `["1.1.1", "1.4.3"]` |

Omit a parameter (or pass empty array) to skip that filter.

## Resources

| URI | Description |
| --- | --- |
| `auditor://standards` | Supported WCAG criteria with levels |
| `auditor://report/{id}` | Full JSON report from a previous audit |

## Configuration

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `AUDITOR_BROWSER_PATH` | Automatic detection | Optional custom Chromium/Chrome executable path |
| `AUDITOR_CONCURRENCY` | `3` | Max concurrent audit pages (hard cap) |
| `AUDITOR_TIMEOUT` | `30000` | Navigation/render timeout (ms) |
| `AUDITOR_HEADLESS` | `true` | Set `false` to see browser |
| `AUDITOR_TRANSPORT` | `stdio` | `stdio` or `sse` |
| `AUDITOR_PORT` | `3100` | Port for SSE transport |

### SSE / HTTP transport

Run the server over Streamable HTTP instead of stdio:

```bash
AUDITOR_TRANSPORT=sse AUDITOR_PORT=3100 npm start
```

The server listens on `127.0.0.1:3100` and accepts MCP requests via `POST /`. Host and Origin headers are validated (localhost only). Graceful shutdown on SIGINT/SIGTERM closes the browser and the HTTP server.

Client config:

```json
{
  "mcpServers": {
    "sitelint-auditor": {
      "url": "http://127.0.0.1:3100"
    }
  }
}
```

### CLI flags

```cli
auditor-mcp --bundle ./custom-bundle.js --timeout 60000 --headless false
```

| Flag | Env equivalent |
| --- | --- |
| `--browser <path>` | `AUDITOR_BROWSER_PATH` |
| `--concurrency <n>` | `AUDITOR_CONCURRENCY` |
| `--timeout <ms>` | `AUDITOR_TIMEOUT` |
| `--headless <bool>` | `AUDITOR_HEADLESS` |
| `--bundle <path>` | — |
| `--transport <stdio \| sse>` | `AUDITOR_TRANSPORT` |
| `--port <n>` | `AUDITOR_PORT` |

## Integration guides

### opencode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "sitelint-auditor": {
      "type": "local",
      "command": ["npx", "-y", "@sitelint/auditor-mcp"]
    }
  }
}
```

For a local build:

```json
{
  "mcp": {
    "sitelint-auditor": {
      "type": "local",
      "command": ["node", "/path/to/auditor-mcp/dist/cli.js"]
    }
  }
}
```

With custom Chromium:

```json
{
  "mcp": {
    "sitelint-auditor": {
      "type": "local",
      "command": ["npx", "-y", "@sitelint/auditor-mcp"],
      "environment": {
        "AUDITOR_BROWSER_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "AUDITOR_TIMEOUT": "60000"
      }
    }
  }
}
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sitelint-auditor": {
      "command": "npx",
      "args": ["-y", "@sitelint/auditor-mcp"]
    }
  }
}
```

### Claude Code

#### Plugin (recommended)

```shell
/plugin marketplace add sitelint/auditor-mcp
/plugin install auditor-mcp@sitelint
```

#### Manual

```shell
claude mcp add sitelint-auditor -- npx -y @sitelint/auditor-mcp
```

### Codex

#### Plugin (recommended)

```shell
codex plugin marketplace add sitelint/auditor-mcp
codex plugin add auditor-mcp@sitelint
```

#### Manual

```shell
codex mcp add sitelint-auditor -- npx -y @sitelint/auditor-mcp
```

### ZCode

```json
{
  "sitelint-auditor": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y",
      "@sitelint/auditor-mcp@latest"
    ]
  }
}
```

### VS Code (Cline)

In Cline extension settings → MCP Servers:

```json
{
  "sitelint-auditor": {
    "command": "npx",
    "args": ["-y", "@sitelint/auditor-mcp"]
  }
}
```

### VS Code (Continue)

In `~/.continue/config.json`:

```json
{
  "experimental": {
    "mcpServers": {
      "sitelint-auditor": {
        "command": "npx",
        "args": ["-y", "@sitelint/auditor-mcp"]
      }
    }
  }
}
```

### AnythingLLM

```json
{
  "mcpServers": {
    "sitelint-auditor": {
      "command": "npx",
      "args": ["-y", "@sitelint/auditor-mcp"]
    }
  }
}
```

### Other MCP clients

Any MCP client can connect. Use `stdio` transport (default) for local tools, or `AUDITOR_TRANSPORT=sse` with `AUDITOR_PORT=3100` for remote.

## Build from source

```bash
git clone <repo>
cd auditor-mcp
npm install
npm run build

# Bundle the auditor engine
cp /path/to/auditor/dist/auditor.bundle.js vendor/
cp /path/to/auditor/app/translations/en-us.json vendor/translations/
```

## Requirements

- Node.js 20+
- Chromium or Chrome (detected automatically, or downloaded by Puppeteer during
  installation/on the first audit if needed)
- SiteLint Auditor bundle (vendored as `vendor/auditor.bundle.js`)

## How it works

1. Launches headless Chromium via Puppeteer (single browser, pages capped by `AUDITOR_CONCURRENCY`)
2. Loads the target page and waits for it to settle (bounded by `AUDITOR_TIMEOUT`)
3. Injects the SiteLint Auditor JS bundle into the page
4. Runs a **single-shot audit** against the current DOM state
5. Formats results into a concise text report with grouping and truncation for long outputs
6. Stores full JSON as a resource accessible via `auditor://report/{id}`

Navigation failures, timeouts, and browser-launch errors are returned as readable messages rather than raw exceptions.

### Limitations vs. embedded auditor

When SiteLint Auditor is embedded directly into a website via `<script>`, it watches for DOM mutations, re-tests dynamically loaded content, and provides an interactive sidebar UI. The MCP server does **not** do any of that — it takes a one-time snapshot of the page at the moment of injection. Content loaded after the audit starts (lazy images, infinite scroll, SPA route transitions) is not evaluated. For SPAs or pages with heavy dynamic content, consider waiting for full render before calling the tool.

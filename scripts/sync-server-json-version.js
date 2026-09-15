import { readFile, writeFile } from 'node:fs/promises';

const syncVersionInJsonFile = async (fileUrl, version) => {
  const json = JSON.parse(await readFile(fileUrl, 'utf8'));

  json.version = version;

  await writeFile(fileUrl, `${JSON.stringify(json, null, 2)}\n`);
};

const syncServerJsonVersion = async () => {
  try {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const serverJsonPath = new URL('../server.json', import.meta.url);
    const server = JSON.parse(await readFile(serverJsonPath, 'utf8'));

    server.version = pkg.version;

    for (const pkgEntry of server.packages ?? []) {
      pkgEntry.version = pkg.version;
    }

    await writeFile(serverJsonPath, `${JSON.stringify(server, null, 2)}\n`);

    await syncVersionInJsonFile(new URL('../plugins/auditor-mcp/plugin.json', import.meta.url), pkg.version);
    await syncVersionInJsonFile(new URL('../plugins/auditor-mcp/.claude-plugin/plugin.json', import.meta.url), pkg.version);

    const claudeMarketplacePath = new URL('../.claude-plugin/marketplace.json', import.meta.url);
    const claudeMarketplace = JSON.parse(await readFile(claudeMarketplacePath, 'utf8'));

    for (const pkgEntry of claudeMarketplace.plugins ?? []) {
      pkgEntry.version = pkg.version;
    }

    await writeFile(claudeMarketplacePath, `${JSON.stringify(claudeMarketplace, null, 2)}\n`);

    console.log(`Synced server.json, marketplace, and plugin versions to ${pkg.version}`);
  } catch (err) {
    console.error(`Failed to sync versions: ${err.message}`);
    process.exit(1);
  }
};

await syncServerJsonVersion();
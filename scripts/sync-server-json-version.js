import { readFile, writeFile } from 'node:fs/promises';

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

    console.log(`Synced server.json version to ${pkg.version}`);
  } catch (err) {
    console.error(`Failed to sync server.json version: ${err.message}`);
    process.exit(1);
  }
};

await syncServerJsonVersion();
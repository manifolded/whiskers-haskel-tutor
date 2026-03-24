import * as esbuild from 'esbuild';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const outFile = join(__dirname, 'dist', 'extension.js');
const cliOutFile = join(__dirname, 'dist', 'whiskers-dump-history.js');

const baseNodeOpts = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode', 'sql.js'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

async function build() {
  mkdirSync(join(__dirname, 'dist'), { recursive: true });

  const extCtx = await esbuild.context({
    ...baseNodeOpts,
    entryPoints: [join(__dirname, 'src', 'extension.ts')],
    outfile: outFile,
  });

  const cliCtx = await esbuild.context({
    ...baseNodeOpts,
    entryPoints: [join(__dirname, 'src', 'cli', 'dumpHistory.ts')],
    outfile: cliOutFile,
    banner: { js: '#!/usr/bin/env node\n' },
  });

  if (watch) {
    await Promise.all([extCtx.watch(), cliCtx.watch()]);
  } else {
    await extCtx.rebuild();
    await cliCtx.rebuild();
    await extCtx.dispose();
    await cliCtx.dispose();
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

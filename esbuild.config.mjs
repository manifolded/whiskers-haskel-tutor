import * as esbuild from 'esbuild';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const outFile = join(__dirname, 'dist', 'extension.js');

async function build() {
  mkdirSync(join(__dirname, 'dist'), { recursive: true });

  const ctx = await esbuild.context({
    entryPoints: [join(__dirname, 'src', 'extension.ts')],
    bundle: true,
    outfile: outFile,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['vscode', 'sql.js'],
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

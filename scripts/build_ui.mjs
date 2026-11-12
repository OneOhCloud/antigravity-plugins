/**
 * @fileoverview Production compiler for the AGY Token Telemetry React + Tailwind
 * frontend. Compiles Tailwind CSS (`src/styles.css` -> `dist/assets/app.css`),
 * bundles and minifies React 18 + application code (`src/main.jsx` ->
 * `dist/assets/app.js`), and emits the production `dist/index.html`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PANE_DIR = join(
  ROOT_DIR,
  'plugins',
  'agy-token-telemetry',
  'sidecars',
  'telemetry-pane'
);
const SRC_DIR = join(PANE_DIR, 'src');
const DIST_DIR = join(PANE_DIR, 'dist');
const ASSETS_DIR = join(DIST_DIR, 'assets');

async function buildTelemetryUi() {
  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(ASSETS_DIR, { recursive: true });

  const tailwindBin = join(ROOT_DIR, 'node_modules', '.bin', 'tailwindcss');
  execFileSync(
    tailwindBin,
    [
      '-i',
      join(SRC_DIR, 'styles.css'),
      '-o',
      join(ASSETS_DIR, 'app.css'),
      '--minify',
    ],
    {
      cwd: PANE_DIR,
      stdio: 'inherit',
    }
  );

  await esbuild.build({
    entryPoints: [join(SRC_DIR, 'main.jsx')],
    bundle: true,
    minify: true,
    treeShaking: true,
    legalComments: 'none',
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    outfile: join(ASSETS_DIR, 'app.js'),
  });

  const prodHtml = [
    '<!DOCTYPE html>',
    '<html lang="en" class="w-full max-w-full h-full overflow-hidden bg-white text-[#1d1d1f] antialiased">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>AGY Telemetry</title>',
    '  <link rel="stylesheet" href="/assets/app.css" />',
    '  <script src="/preload.js"></script>',
    '</head>',
    '<body class="w-full max-w-full h-full overflow-hidden bg-white text-[#1d1d1f] text-[13px] leading-[1.45] font-sans antialiased">',
    '  <div id="root" class="w-full max-w-full h-full overflow-hidden"></div>',
    '  <script src="/assets/app.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');

  writeFileSync(join(DIST_DIR, 'index.html'), prodHtml, 'utf-8');

  console.log(
    '[build_ui] Built production dist/index.html, dist/assets/app.css, and dist/assets/app.js.'
  );
}

buildTelemetryUi().catch((err) => {
  console.error('[build_ui] Build failed:', err);
  process.exit(1);
});

// Renders review stills at given frames, bundling once.
import path from 'node:path';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('./no-rspack.cjs');
const { bundle } = await import('@remotion/bundler');
const { renderStill, selectComposition } = await import('@remotion/renderer');

const frames = process.argv.slice(2).map(Number);
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'FarmLinkExplainer', browserExecutable });
for (const frame of frames) {
  await renderStill({ composition, serveUrl, frame, output: `out/stills/f${String(frame).padStart(4, '0')}.png`, browserExecutable });
  console.log('still', frame);
}

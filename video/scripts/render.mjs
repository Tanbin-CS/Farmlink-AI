// Renders the explainer to out/farmlink-ai-explainer-1080p.mp4 and writes matching English subtitles (.srt).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('./no-rspack.cjs');
const { bundle } = await import('@remotion/bundler');
const { renderMedia, selectComposition } = await import('@remotion/renderer');

const browserExecutable = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const out = 'out/farmlink-ai-explainer-1080p.mp4';
const INTRO = 2; // keep in sync with src/timing.ts

const cues = JSON.parse(fs.readFileSync('src/cues.json', 'utf8')).cues;
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = cues
  .map((c, i) => {
    const next = cues[i + 1];
    const end = next && next.start - c.end < 0.7 ? next.start : c.end + 0.35;
    return `${i + 1}\n${ts(INTRO + c.start)} --> ${ts(INTRO + end)}\n${c.text}\n`;
  })
  .join('\n');
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/farmlink-ai-explainer-en.srt', srt);

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'FarmLinkExplainer', browserExecutable });
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 18,
  audioCodec: 'aac',
  audioBitrate: '192k',
  outputLocation: out,
  browserExecutable,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct % 10 === 0 && pct !== last) {
      last = pct;
      console.log(`render ${pct}%`);
    }
  },
});
console.log('done', out);

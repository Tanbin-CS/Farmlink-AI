# FarmLink AI explainer video

Motion explainer (about 1 min 51 s, 1920×1080, 30 fps), built with [Remotion](https://www.remotion.dev/).
Separate from the app: not an npm workspace, not part of the app build.

- `src/` holds 9 animated scenes (`scenesA/B/C.tsx`) timed to the narration.
  - `src/cues.json` holds the subtitle lines and timings, aligned to the voice recording.
  - `src/cashflow.json` is the demo cooperative's real daily projection from `@farmlink/engine` (`npm run export-cashflow`).
- `public/voice.wav` (narration) and `public/music.wav` (original, procedurally generated background music) are not committed.
- `npm run stills -- 354 1770` renders review frames. `npm run render` writes `out/farmlink-ai-explainer-1080p.mp4` and `out/farmlink-ai-explainer-en.srt`.

`scripts/no-rspack.cjs` stubs `@rspack/core`. Remotion's bundler imports it even when bundling with webpack (the default), and its native binary crashes in some containers.

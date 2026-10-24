import cuesData from './cues.json';

export const FPS = 30;
/** Seconds of title card before the voice starts. */
export const INTRO = 2;
/** Seconds the closing card stays up after the voice ends. */
export const OUTRO = 4.5;
export const VOICE_SECONDS = 104.96;
export const DURATION_FRAMES = Math.round((INTRO + VOICE_SECONDS + OUTRO) * FPS);

export interface Cue {
  scene: number;
  text: string;
  start: number;
  end: number;
}

export const CUES: Cue[] = cuesData.cues;

/** Voice time (seconds) to absolute video frame. */
export const vf = (sec: number) => Math.round((INTRO + sec) * FPS);

/** Scene boundaries in absolute frames, derived from when each scene's first line is spoken. */
export const SCENES = Array.from({ length: 9 }, (_, i) => {
  const first = CUES.find((c) => c.scene === i)!;
  const next = CUES.find((c) => c.scene === i + 1);
  const start = i === 0 ? vf(0) : vf(first.start) - 6;
  const end = next ? vf(next.start) - 6 : DURATION_FRAMES;
  return { start, end };
});

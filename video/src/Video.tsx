import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, continueRender, delayRender } from 'remotion';
import { C } from './theme';
import { Subtitles } from './kit';
import { Hook, Intro, Meet, Problem } from './scenesA';
import { Compare, Forecast, Stress } from './scenesB';
import { Agent, Close, Human } from './scenesC';
import { DURATION_FRAMES, FPS, INTRO, SCENES, VOICE_SECONDS } from './timing';

const SCENE_COMPONENTS = [Hook, Problem, Meet, Forecast, Compare, Stress, Agent, Human, Close];

// DM Sans, bundled locally so rendering never depends on the network.
const fontHandle = delayRender('Loading DM Sans');
Promise.all(
  [
    ['dmsans-latin.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'],
    ['dmsans-latin-ext.woff2', 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF'],
  ].map(([file, range]) => {
    const face = new FontFace('DM Sans', `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight: '400 700', unicodeRange: range });
    document.fonts.add(face);
    return face.load();
  }),
)
  .then(() => continueRender(fontHandle))
  .catch(() => continueRender(fontHandle));

const voiceEnd = Math.round((INTRO + VOICE_SECONDS) * FPS);

export const FarmLinkExplainer: React.FC = () => (
  <AbsoluteFill style={{ background: C.deep }}>
    <Sequence durationInFrames={SCENES[0].start + 12}>
      <Intro end={SCENES[0].start + 12} />
    </Sequence>
    {SCENE_COMPONENTS.map((Scene, i) => {
      const { start, end } = SCENES[i];
      const from = Math.max(0, start - 4);
      const until = Math.min(DURATION_FRAMES, end + 10);
      return (
        <Sequence key={i} from={from} durationInFrames={until - from}>
          <Scene start={from} end={until} />
        </Sequence>
      );
    })}
    <Subtitles />
    <Sequence from={Math.round(INTRO * FPS)}>
      <Audio src={staticFile('voice.wav')} />
    </Sequence>
    {/* Original background music: louder on the title cards, ducked under the voice. */}
    <Audio
      src={staticFile('music.wav')}
      volume={(f) =>
        interpolate(f, [0, INTRO * FPS - 10, INTRO * FPS + 10, voiceEnd, voiceEnd + 20, DURATION_FRAMES], [0.55, 0.55, 0.13, 0.13, 0.5, 0.35], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      }
    />
  </AbsoluteFill>
);

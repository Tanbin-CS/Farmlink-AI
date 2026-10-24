import React from 'react';
import { Composition } from 'remotion';
import { FarmLinkExplainer } from './Video';
import { DURATION_FRAMES, FPS } from './timing';

export const Root: React.FC = () => (
  <Composition id="FarmLinkExplainer" component={FarmLinkExplainer} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} />
);

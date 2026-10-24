import { useState } from 'react';
import { Play, Youtube } from 'lucide-react';
import { Reveal } from '@/components/motion';

export const EXPLAINER_VIDEO_ID = 'In0M4g6hLow';
const WATCH_URL = `https://youtu.be/${EXPLAINER_VIDEO_ID}`;

/**
 * Click-to-load YouTube embed: nothing is requested from YouTube's player (and no cookies are set)
 * until the visitor presses play, and then only via the privacy-enhanced youtube-nocookie domain.
 */
export function ExplainerVideo() {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${EXPLAINER_VIDEO_ID}/maxresdefault.jpg`);

  return (
    <section id="video" className="mx-auto max-w-5xl px-4 pb-16">
      <Reveal className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Watch the explainer · 1 min 51 s</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">FarmLink AI in under two minutes</h2>
        <p className="mx-auto mt-2 max-w-2xl text-stone-600">The cash gap, honest loan comparison, the stress test, and why only a human can submit. English subtitles included.</p>
      </Reveal>
      <Reveal className="mt-8">
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-brand-gradient shadow-[var(--shadow-lift)] ring-1 ring-stone-200/80">
          {playing ? (
            <iframe
              className="absolute inset-0 size-full"
              src={`https://www.youtube-nocookie.com/embed/${EXPLAINER_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&cc_load_policy=0`}
              title="FarmLink AI explainer video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 size-full cursor-pointer" aria-label="Play the FarmLink AI explainer video">
              <img
                src={thumb}
                onError={() => setThumb(`https://i.ytimg.com/vi/${EXPLAINER_VIDEO_ID}/hqdefault.jpg`)}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" aria-hidden />
              <span className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-brand-700 shadow-xl ring-8 ring-white/25 transition-transform duration-300 group-hover:scale-110">
                <Play className="ml-1 size-9 fill-current" aria-hidden />
              </span>
            </button>
          )}
        </div>
        <div className="mt-3 flex justify-center">
          <a href={WATCH_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-stone-600 underline-offset-4 hover:text-brand-700 hover:underline">
            <Youtube className="size-4" aria-hidden /> Watch on YouTube
          </a>
        </div>
      </Reveal>
    </section>
  );
}

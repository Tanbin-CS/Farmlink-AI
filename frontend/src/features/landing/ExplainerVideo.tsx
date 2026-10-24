import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Volume2, Youtube } from 'lucide-react';
import { Reveal } from '@/components/motion';

export const EXPLAINER_VIDEO_ID = 'In0M4g6hLow';
const WATCH_URL = `https://youtu.be/${EXPLAINER_VIDEO_ID}`;

/** True once the visitor has clicked, tapped or typed on the page (browsers only allow sound after that). */
const hasUserActivation = () => (typeof navigator !== 'undefined' && 'userActivation' in navigator ? navigator.userActivation.hasBeenActive : false);
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * YouTube embed (privacy-enhanced youtube-nocookie domain) that starts playing when it scrolls into view.
 * Browsers block sound until the visitor has interacted with the page, so it starts muted in that case and
 * offers a one-tap "sound on" button. It pauses when scrolled away. Reduced-motion users get click-to-play.
 */
export function ExplainerVideo() {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [startMuted, setStartMuted] = useState(true);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${EXPLAINER_VIDEO_ID}/maxresdefault.jpg`);

  const command = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  }, []);

  const start = useCallback((withSound: boolean) => {
    setMuted(!withSound);
    setStartMuted(!withSound);
    setLoaded(true);
  }, []);

  // Autoplay when at least half of the player is visible; pause when it leaves the screen.
  useEffect(() => {
    const el = box.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (!loaded) start(hasUserActivation());
          else command('playVideo');
        } else if (loaded) {
          command('pauseVideo');
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loaded, start, command]);

  const soundOn = () => {
    command('unMute');
    command('setVolume', [100]);
    command('playVideo');
    setMuted(false);
  };

  const src = `https://www.youtube-nocookie.com/embed/${EXPLAINER_VIDEO_ID}?autoplay=1&mute=${startMuted ? 1 : 0}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;

  return (
    <section id="video" className="mx-auto max-w-5xl px-4 pb-16">
      <Reveal className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Watch the explainer · 1 min 51 s</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">FarmLink AI in under two minutes</h2>
        <p className="mx-auto mt-2 max-w-2xl text-stone-600">The cash gap, honest loan comparison, the stress test, and why only a human can submit. English subtitles included.</p>
      </Reveal>
      <Reveal className="mt-8">
        <div ref={box} className="relative aspect-video overflow-hidden rounded-3xl bg-brand-gradient shadow-[var(--shadow-lift)] ring-1 ring-stone-200/80">
          {loaded ? (
            <>
              {/* The src is fixed once loaded; later sound changes go through the player API, not a reload. */}
              <iframe
                ref={frame}
                className="absolute inset-0 size-full"
                src={src}
                title="FarmLink AI explainer video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
              {muted ? (
                <button
                  type="button"
                  onClick={soundOn}
                  className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-lg ring-4 ring-white/30 transition-transform hover:scale-105 sm:left-5 sm:top-5 sm:text-base"
                >
                  <Volume2 className="size-5" aria-hidden /> Tap for sound
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" onClick={() => start(true)} className="group absolute inset-0 size-full cursor-pointer" aria-label="Play the FarmLink AI explainer video">
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

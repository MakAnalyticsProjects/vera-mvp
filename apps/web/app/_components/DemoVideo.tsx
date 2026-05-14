'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Floating sound toggle. Sits over the video card.
function MuteButton({
  muted,
  interacted,
  onClick,
}: {
  muted: boolean;
  interacted: boolean;
  onClick: () => void;
}) {
  const Icon = muted ? VolumeX : Volume2;
  const ariaLabel = muted ? 'Unmute demo video' : 'Mute demo video';
  // First-time hint: "Tap to unmute" appears until the visitor toggles once.
  const showHint = muted && !interacted;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="bg-bg-card/90 border-border text-text-primary hover:bg-bg-card focus-visible:ring-accent absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-md backdrop-blur transition focus-visible:ring-2 focus-visible:outline-none md:right-4 md:bottom-4 md:px-4 md:text-sm"
    >
      <Icon className="h-4 w-4" />
      {showHint && <span>Tap to unmute</span>}
    </button>
  );
}

const MOBILE_QUERY = '(max-width: 767px)';

export function DemoVideo() {
  const [muted, setMuted] = useState(true);
  const [interacted, setInteracted] = useState(false);
  // `isMobile` mirrors the same Tailwind breakpoint that decides which
  // <video> is visually rendered. The Tailwind class swap handles paint;
  // this state lets the unmute handler target the right element. Default
  // false so SSR matches the desktop initial paint.
  const [isMobile, setIsMobile] = useState(false);
  const desktopRef = useRef<HTMLVideoElement>(null);
  const mobileRef = useRef<HTMLVideoElement>(null);

  // Track which breakpoint we're in so we only ever drive ONE video. The
  // other one stays paused — preventing the dual-audio "echo" that happens
  // when display:none videos keep their audio pipeline running after unmute.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const apply = (mobile: boolean) => {
      setIsMobile(mobile);
      const active = mobile ? mobileRef.current : desktopRef.current;
      const inactive = mobile ? desktopRef.current : mobileRef.current;
      if (inactive) {
        inactive.muted = true;
        inactive.pause();
      }
      if (active) {
        active.muted = muted;
        void active.play().catch(() => undefined);
      }
    };
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setInteracted(true);
    // Only the visible video gets unmuted. The inactive one stays paused so
    // its audio pipeline doesn't double up with the active video's voice.
    const active = isMobile ? mobileRef.current : desktopRef.current;
    const inactive = isMobile ? desktopRef.current : mobileRef.current;
    if (active) {
      active.muted = next;
      if (!next) {
        // Restart from t=0 on first unmute so the visitor hears the
        // narration from the top, not mid-sentence.
        active.currentTime = 0;
        void active.play().catch(() => undefined);
      }
    }
    if (inactive) {
      inactive.muted = true;
      inactive.pause();
    }
  }

  return (
    <section className="mt-16 vera-rise-delay-1">
      {/* Mobile — portrait */}
      <div className="border-border bg-bg-card relative mx-auto max-w-[28rem] overflow-hidden rounded-[var(--radius-card)] border shadow-[0_8px_24px_-6px_rgba(31,27,22,0.08)] md:hidden">
        <video
          ref={mobileRef}
          src="/vera-demo-mobile.mp4"
          poster="/vera-demo-mobile-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="A vertical walkthrough of Vera — sign-in, today's briefing, heat distribution, aging, milestones, follow-ups, reconciliation, the rep leaderboard, write-offs, scheduler with data sync, audit log, and a drafted email."
          className="block aspect-[9/16] w-full"
        />
        <MuteButton muted={muted} interacted={interacted} onClick={toggleMute} />
      </div>
      {/* Tablet & desktop — landscape */}
      <div className="border-border bg-bg-card relative hidden overflow-hidden rounded-[var(--radius-card)] border shadow-[0_8px_24px_-6px_rgba(31,27,22,0.08)] md:block">
        <video
          ref={desktopRef}
          src="/vera-demo.mp4"
          poster="/vera-demo-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="A walkthrough of Vera — sign-in, today's briefing, heat distribution, aging, milestones, follow-ups, reconciliation, the rep leaderboard, write-offs, scheduler with data sync, audit log, and a drafted email."
          className="block aspect-[16/9] w-full"
        />
        <MuteButton muted={muted} interacted={interacted} onClick={toggleMute} />
      </div>
    </section>
  );
}

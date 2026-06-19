'use client';

import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function ParallaxContainer({ children }: { children: React.ReactNode }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Back plane - static background */}
      <div className="geo-plane geo-plane-back fixed inset-0 -z-30 bg-gradient-to-b from-slate-50 to-slate-100" />

      {/* Mid plane — fixed to viewport, background shifts at 12% scroll speed
           backgroundPositionY = scrollY * 0.12 → content at 100% feels much faster → slow parallax drift */}
      <div
        className="geo-plane geo-plane-mid fixed inset-0 -z-20 pointer-events-none"
        style={{
          backgroundImage: `url('${BASE}/parallax/building-pattern-l.png'), url('${BASE}/parallax/building-pattern-r.png')`,

          backgroundRepeat: 'repeat-y, repeat-y',
          backgroundPosition: `left ${(scrollY * 0.12).toFixed(2)}px, right ${(scrollY * 0.12).toFixed(2)}px`,
          backgroundSize: 'auto 800px, auto 800px',
        }}
      />

      {/* Third plane - explicit horizontal image layer */}
      <div
        className="geo-plane geo-plane-third fixed inset-0 z-[-25] pointer-events-none"
        style={{
          transform: `translate3d(${(scrollY * 0.12).toFixed(2)}px, 0, 0)`,
        }}
      >
        <img
          src={`${BASE}/parallax/cloud-h.png`}
          alt=""
          aria-hidden="true"
          className="absolute -right-16 top-16 w-[420px] max-w-[55vw]"
        />
        <img
          src={`${BASE}/parallax/cloud-h.png`}
          alt=""
          aria-hidden="true"
          className="absolute left-[18%] bottom-10 w-[360px] max-w-[48vw]"
        />
      </div>

      {/* Content - scrolls normally */}
      <div className="relative z-0">{children}</div>
    </div>
  );
}

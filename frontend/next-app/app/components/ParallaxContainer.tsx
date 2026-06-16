'use client';

import { useEffect, useState } from 'react';

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

      {/* Mid plane - repeating pattern with parallax */}
      <div
        className="geo-plane geo-plane-mid fixed inset-0 -z-20 opacity-30"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(100, 150, 200, 0.1) 35px,
              rgba(100, 150, 200, 0.1) 70px
            )
          `,
          backgroundSize: '100% 100%',
          transform: `translate3d(0, ${(-scrollY * 0.08).toFixed(2)}px, 0)`,
          transformOrigin: 'center top',
        }}
      />

      {/* Third plane - horizontal parallax */}
      <div
        className="geo-plane geo-plane-third fixed inset-0 -z-10 pointer-events-none"
        style={{
          transform: `translate3d(${(scrollY * 0.12).toFixed(2)}px, 0, 0)`,
        }}
      >
        <div className="absolute right-0 top-20 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute left-1/4 bottom-20 w-80 h-80 bg-gradient-to-tr from-slate-300/10 to-slate-200/10 rounded-full blur-3xl" />
      </div>

      {/* Content - scrolls normally */}
      <div className="relative z-0">{children}</div>
    </div>
  );
}

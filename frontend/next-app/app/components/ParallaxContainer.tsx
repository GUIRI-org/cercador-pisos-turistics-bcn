'use client';

import { useEffect, useRef } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function ParallaxContainer({ children }: { children: React.ReactNode }) {
  const midPlaneRef = useRef<HTMLDivElement>(null);
  const cloudPlaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const updateParallax = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const midPlane = midPlaneRef.current;
      if (midPlane) {
        const verticalOffset = (scrollY * 0.18).toFixed(2);
        midPlane.style.setProperty('--building-scroll-offset', `${verticalOffset}px`);
      }

      const cloudPlane = cloudPlaneRef.current;
      if (!cloudPlane) return;

      const viewportWidth = window.innerWidth;
      const clouds = cloudPlane.querySelectorAll<HTMLElement>('[data-parallax-cloud]');
      clouds.forEach((cloud, index) => {
        const cloudWidth = cloud.getBoundingClientRect().width;
        const travelWidth = viewportWidth + cloudWidth;
        const speed = index === 0 ? 0.24 : 0.16;
        const distance = (scrollY * speed) % travelWidth;
        const x = index === 0 ? distance - cloudWidth : viewportWidth - distance;
        cloud.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
      });
    };

    const scheduleParallax = () => {
      if (!frame) frame = requestAnimationFrame(updateParallax);
    };

    window.addEventListener('scroll', scheduleParallax, { passive: true });
    window.addEventListener('resize', scheduleParallax, { passive: true });
    scheduleParallax();

    return () => {
      window.removeEventListener('scroll', scheduleParallax);
      window.removeEventListener('resize', scheduleParallax);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="parallax-scene">
      <div className="geo-plane geo-plane-back" aria-hidden="true" />

      <div
        ref={midPlaneRef}
        className="geo-plane geo-plane-mid"
        aria-hidden="true"
        style={{
          backgroundImage: `url('${BASE}/parallax/building-pattern-l2.jpg'), url('${BASE}/parallax/building-pattern-r2.jpg')`,
        }}
      />

      <div ref={cloudPlaneRef} className="geo-plane geo-plane-third" aria-hidden="true">
        <div
          data-parallax-cloud
          className="parallax-cloud parallax-cloud--one"
          style={{ backgroundImage: `url('${BASE}/parallax/cloud-h.png')` }}
        />
        <div
          data-parallax-cloud
          className="parallax-cloud parallax-cloud--two"
          style={{ backgroundImage: `url('${BASE}/parallax/cloud-h.png')` }}
        />
      </div>

      <div className="parallax-content">{children}</div>
    </div>
  );
}

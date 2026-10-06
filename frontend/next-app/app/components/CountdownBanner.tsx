'use client';

import { useEffect, useState } from 'react';

const TARGET_DATE = new Date('2028-01-01T00:00:00');

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  completed: boolean;
}

const getCountdownTime = (): CountdownTime => {
  const milliseconds = Math.max(0, TARGET_DATE.getTime() - Date.now());
  const totalSeconds = Math.floor(milliseconds / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    completed: milliseconds === 0,
  };
};

export function CountdownBanner() {
  const [time, setTime] = useState<CountdownTime | null>(null);

  useEffect(() => {
    const update = () => setTime(getCountdownTime());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const message = time?.completed
    ? 'Ja és 1 de gener de 2028!'
    : `${time?.days ?? '--'} dies · ${time?.hours ?? '--'} hores · ${time?.minutes ?? '--'} minuts · ${time?.seconds ?? '--'} segons`;

  return (
    <div className="countdown-banner" role="timer" aria-live="off" aria-label={message}>
      <div className="countdown-marquee" aria-hidden="true">
        <div className="countdown-marquee__track">
          <span className="countdown-marquee__item">{message}</span>
          <span className="countdown-marquee__item">{message}</span>
        </div>
      </div>
    </div>
  );
}

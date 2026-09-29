'use client';

import Countdown, { CountdownRenderProps } from 'react-countdown';

const TARGET_DATE = new Date('2028-01-01T00:00:00');

const renderer = ({ days, hours, minutes, seconds, completed }: CountdownRenderProps) => {
  if (completed) {
    return <span className="fw-semibold">Ja és 1 de gener de 2028!</span>;
  }

  const units = [
    { value: days, label: 'dies' },
    { value: hours, label: 'hores' },
    { value: minutes, label: 'minuts' },
    { value: seconds, label: 'segons' },
  ];

  return (
    <div className="d-flex gap-3 flex-wrap" role="timer" aria-live="off">
      {units.map((unit) => (
        <div key={unit.label} className="text-center">
          <div className="fs-2 fw-bold text-primary lh-1">{String(unit.value).padStart(2, '0')}</div>
          <div className="text-uppercase text-secondary" style={{ fontSize: '0.7rem' }}>{unit.label}</div>
        </div>
      ))}
    </div>
  );
};

export function CountdownBanner() {
  return (
    <div className="countdown-banner mb-4">
      <p className="text-secondary mb-2">Compte enrere fins a l&apos;1 de gener de 2028:</p>
      <Countdown date={TARGET_DATE} renderer={renderer} />
    </div>
  );
}

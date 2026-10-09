import type { ApartmentDetail } from '@/lib/types';
import { comparePis, formatPisAddressDisplay, normalizePis } from '../lib/floors';

interface PlacesWaffleProps {
  apartments: ApartmentDetail[];
}

const MAX_COLUMNS = 14;
const MIN_FLOORS = 3;

// One block of rows per floor, top floor first; each square is one place and only the last row of a floor is padded with blanks.
export function PlacesWaffle({ apartments }: PlacesWaffleProps) {
  if (apartments.length === 0) return null;

  const placesByFloor = new Map<string, number>();
  apartments.forEach((apt) => {
    const floor = normalizePis(apt.pis);
    placesByFloor.set(floor, (placesByFloor.get(floor) ?? 0) + (apt.num_places || 0));
  });

  const highestNumbered = Math.max(
    0,
    ...Array.from(placesByFloor.keys())
      .filter((floor) => /^\d+$/.test(floor))
      .map((floor) => Number.parseInt(floor, 10))
  );
  // Floors 1..N are always listed (N is at least MIN_FLOORS); taller buildings add nothing above their highest floor.
  const floorKeys = new Set(placesByFloor.keys());
  for (let floor = 1; floor <= Math.max(highestNumbered, MIN_FLOORS); floor++) {
    floorKeys.add(String(floor).padStart(2, '0'));
  }
  const floors = Array.from(floorKeys).sort((a, b) => comparePis(b, a));

  const total = Array.from(placesByFloor.values()).reduce((sum, places) => sum + places, 0);
  const maxPlaces = Math.max(1, ...placesByFloor.values());
  const columns = Math.min(maxPlaces, MAX_COLUMNS);

  return (
    <div className="places-waffle" role="img" aria-label={`${total} places repartides en ${floors.length} plantes`}>
      {floors.map((floor) => {
        const places = placesByFloor.get(floor) ?? 0;
        const label = formatPisAddressDisplay(floor);
        // A floor without places still gets one blank row so it stays listed.
        const slots = Math.max(1, Math.ceil(places / columns)) * columns;
        return (
          <div key={floor} className="places-waffle__row" title={`${label}: ${places} places`}>
            <span className="places-waffle__floor">{label}</span>
            <span className="places-waffle__cells" style={{ gridTemplateColumns: `repeat(${columns}, 8px)` }}>
              {Array.from({ length: slots }, (_, idx) => (
                <span
                  key={idx}
                  className={`places-waffle__cell${idx < places ? '' : ' places-waffle__cell--empty'}`}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

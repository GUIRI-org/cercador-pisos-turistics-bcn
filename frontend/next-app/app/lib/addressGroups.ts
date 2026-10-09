import type { AddressGroup, ApartmentDetail } from '@/lib/types';

export const normalizePart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

export const getAddressGroupKey = (group: AddressGroup) => {
  return [
    normalizePart(group.tipus_carrer),
    normalizePart(group.carrer),
    normalizePart(group.num1),
    normalizePart(group.lletra1),
    normalizePart(group.num2),
    normalizePart(group.lletra2),
    normalizePart(group.address),
    normalizePart(group.latitud_y),
    normalizePart(group.longitud_x),
  ].join('|');
};

export const formatStreetName = (group: AddressGroup, streetName?: string) =>
  streetName || `${group.tipus_carrer || ''} ${group.carrer || ''}`.trim();

export const formatAddress = (group: AddressGroup, streetName?: string) => {
  const street = formatStreetName(group, streetName);
  const number = `${group.num1 ?? ''}${group.lletra1 || ''}`.trim();
  if (street && number) return `${street}, ${number}`;
  // Falls back to the raw address, adding the comma before its first number.
  return (group.address || '').replace(/\s+(\d)/, ', $1');
};

export const formatArea = (group: AddressGroup) =>
  [group.nom_districte, group.nom_barri].filter(Boolean) as string[];

const normalizePis = (value: string | number | null | undefined) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '-';

  if (/^\d+$/.test(rawValue)) {
    return rawValue.padStart(2, '0');
  }

  return rawValue;
};

const getApartmentKey = (apt: ApartmentDetail) => {
  return [
    normalizePart(apt.expedient),
    normalizePart(apt.registre_generalitat),
    normalizePart(apt.bloc),
    normalizePart(apt.portal),
    normalizePart(apt.escala),
    normalizePart(normalizePis(apt.pis)),
    normalizePart(apt.porta),
    normalizePart(apt.year),
    normalizePart(apt.num_places),
  ].join('|');
};

export const dedupeAddressGroups = (groups: AddressGroup[]): AddressGroup[] => {
  const merged = new Map<string, AddressGroup>();

  groups.forEach((group) => {
    const groupKey = getAddressGroupKey(group);
    const existing = merged.get(groupKey);

    if (!existing) {
      merged.set(groupKey, {
        ...group,
        apartments: [...group.apartments],
      });
      return;
    }

    const apartmentsByKey = new Map<string, ApartmentDetail>();
    [...existing.apartments, ...group.apartments].forEach((apt) => {
      apartmentsByKey.set(getApartmentKey(apt), apt);
    });

    const uniqueApartments = Array.from(apartmentsByKey.values());
    const hasApartments = uniqueApartments.length > 0;
    const dedupedTotalPlaces = uniqueApartments.reduce((sum, apt) => sum + (apt.num_places || 0), 0);

    merged.set(groupKey, {
      ...existing,
      address: existing.address || group.address,
      tipus_carrer: existing.tipus_carrer ?? group.tipus_carrer,
      carrer: existing.carrer ?? group.carrer,
      num1: existing.num1 ?? group.num1,
      lletra1: existing.lletra1 ?? group.lletra1,
      num2: existing.num2 ?? group.num2,
      lletra2: existing.lletra2 ?? group.lletra2,
      codi_districte: existing.codi_districte ?? group.codi_districte,
      nom_districte: existing.nom_districte ?? group.nom_districte,
      codi_barri: existing.codi_barri ?? group.codi_barri,
      nom_barri: existing.nom_barri ?? group.nom_barri,
      longitud_x: existing.longitud_x ?? group.longitud_x,
      latitud_y: existing.latitud_y ?? group.latitud_y,
      apartments: uniqueApartments,
      apartments_count: hasApartments
        ? uniqueApartments.length
        : Math.max(existing.apartments_count, group.apartments_count),
      total_places: hasApartments
        ? dedupedTotalPlaces
        : Math.max(existing.total_places, group.total_places),
    });
  });

  return Array.from(merged.values());
};

export const compareByStreetNumber = (a: AddressGroup, b: AddressGroup) => {
  const aNum = a.num1 ?? Number.POSITIVE_INFINITY;
  const bNum = b.num1 ?? Number.POSITIVE_INFINITY;
  if (aNum !== bNum) return aNum - bNum;
  return (a.lletra1 || '').localeCompare(b.lletra1 || '', 'ca');
};

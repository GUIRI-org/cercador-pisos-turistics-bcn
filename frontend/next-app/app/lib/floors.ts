export const normalizePis = (value: string | number | null | undefined) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '-';

  if (/^\d+$/.test(rawValue)) {
    return rawValue.padStart(2, '0');
  }

  return rawValue;
};

// Named floors sort before numbered floors; BJ sorts first, while AT keeps its default position after the numbers.
export const PIS_LABELS: Record<string, string> = {
  BJ: 'Baix',
  EN: 'Entresuelo',
  PR: 'Principal',
  AT: 'Àtic',
  SA: 'Sobre Àtic'
};
const PIS_SPECIAL_SORT_ORDER: Record<string, number> = { BJ: -3, EN: -2, PR: -1 };

export const formatPisAddressDisplay = (pis: string) => {
  const label = PIS_LABELS[pis.toUpperCase()];
  if (label) return label;
  if (!/^\d+$/.test(pis)) return pis;
  return `${Number.parseInt(pis, 10)}º`;
};

// Orders floors from the ground up.
export const comparePis = (pisA: string, pisB: string) => {
  const aSpecial = PIS_SPECIAL_SORT_ORDER[pisA.toUpperCase()];
  const bSpecial = PIS_SPECIAL_SORT_ORDER[pisB.toUpperCase()];

  if (aSpecial !== undefined || bSpecial !== undefined) {
    if (aSpecial !== undefined && bSpecial !== undefined) return aSpecial - bSpecial;
    return aSpecial !== undefined ? -1 : 1;
  }

  const aNum = Number.parseInt(pisA, 10);
  const bNum = Number.parseInt(pisB, 10);
  const aIsNum = !Number.isNaN(aNum);
  const bIsNum = !Number.isNaN(bNum);

  if (aIsNum && bIsNum) return aNum - bNum;
  if (aIsNum) return -1;
  if (bIsNum) return 1;

  return pisA.localeCompare(pisB, 'ca');
};

export const hashStringToHue = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
};

export const getDistrictColor = (district: string) =>
  `hsl(${hashStringToHue(district)}, 60%, 45%)`;
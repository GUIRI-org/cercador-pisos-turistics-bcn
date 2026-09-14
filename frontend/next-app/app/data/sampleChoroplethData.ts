import type { ChoroplethDatum } from '../components/ChoroplethMap';

// Sample apartment counts per district/neighbourhood, for testing the choropleth
// until real GUIRI aggregates are wired in.
export const SAMPLE_DISTRICT_DATA: ChoroplethDatum[] = [
  { code: '1', value: 842, label: 'Ciutat Vella' },
  { code: '2', value: 2145, label: 'Eixample' },
  { code: '3', value: 1210, label: 'Sants-Montjuïc' },
  { code: '4', value: 430, label: 'Les Corts' },
  { code: '5', value: 615, label: 'Sarrià-Sant Gervasi' },
  { code: '6', value: 980, label: 'Gràcia' },
  { code: '7', value: 320, label: 'Horta-Guinardó' },
  { code: '8', value: 145, label: 'Nou Barris' },
  { code: '9', value: 260, label: 'Sant Andreu' },
  { code: '10', value: 705, label: 'Sant Martí' },
];

export const SAMPLE_NEIGHBOURHOOD_DATA: ChoroplethDatum[] = [
  { code: '1', value: 410, label: 'el Raval' },
  { code: '2', value: 432, label: 'el Gòtic - Barceloneta' },
  { code: '3', value: 1180, label: "la Dreta de l'Eixample" },
  { code: '4', value: 965, label: 'la Sagrada Família' },
  { code: '5', value: 640, label: 'Poble-sec' },
  { code: '6', value: 570, label: 'Sants' },
  { code: '7', value: 430, label: 'les Corts' },
  { code: '8', value: 340, label: 'Sant Gervasi' },
  { code: '9', value: 275, label: 'Sarrià' },
  { code: '10', value: 980, label: 'Vila de Gràcia' },
  { code: '11', value: 180, label: 'el Guinardó' },
  { code: '12', value: 140, label: 'Horta' },
  { code: '13', value: 145, label: 'Nou Barris' },
  { code: '14', value: 260, label: 'Sant Andreu' },
  { code: '15', value: 480, label: 'el Poblenou' },
  { code: '16', value: 225, label: 'Sant Martí de Provençals' },
];

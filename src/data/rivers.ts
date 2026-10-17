/**
 * Trazados APROXIMADOS (no topográficos) de los ríos San Juan y Baudó para la
 * vista offline. El río Atrato proviene de Natural Earth.
 */
export const APPROX_RIVERS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'rio_aprox', name: 'Río San Juan (aprox.)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-76.37, 5.33], [-76.48, 5.3], [-76.56, 5.265], [-76.62, 5.22], [-76.66, 5.19], [-76.685, 5.16], [-76.7, 5.1],
          [-76.74, 5.03], [-76.82, 4.96], [-76.9, 4.86], [-76.96, 4.74], [-77.04, 4.6], [-77.12, 4.47], [-77.22, 4.36],
          [-77.33, 4.28], [-77.37, 4.25], [-77.45, 4.18], [-77.5, 4.12],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'rio_aprox', name: 'Río Baudó (aprox.)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-76.98, 6.05], [-76.97, 5.85], [-76.99, 5.68], [-76.975, 5.515], [-76.96, 5.36], [-76.95, 5.19], [-77.02, 5.1],
          [-77.13, 5.03], [-77.25, 4.98], [-77.366, 4.954], [-77.4, 4.94],
        ],
      },
    },
  ],
};

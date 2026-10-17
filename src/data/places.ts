/**
 * Nomenclátor local (funciona sin internet): cabeceras municipales del Chocó y
 * puntos de referencia. Coordenadas aproximadas (WGS84) de la cabecera urbana.
 * Con conexión, la búsqueda también consulta OpenStreetMap Nominatim.
 */
export interface Place {
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  kind: 'capital' | 'cabecera' | 'referencia' | 'vecino';
}

export const PLACES: Place[] = [
  { name: 'Quibdó', municipality: 'Quibdó', lat: 5.6919, lng: -76.6583, kind: 'capital' },
  { name: 'Istmina', municipality: 'Istmina', lat: 5.1603, lng: -76.6847, kind: 'cabecera' },
  { name: 'Tadó', municipality: 'Tadó', lat: 5.2655, lng: -76.5606, kind: 'cabecera' },
  { name: 'Condoto', municipality: 'Condoto', lat: 5.0914, lng: -76.6497, kind: 'cabecera' },
  { name: 'Bahía Solano (Ciudad Mutis)', municipality: 'Bahía Solano', lat: 6.2224, lng: -77.4031, kind: 'cabecera' },
  { name: 'Nuquí', municipality: 'Nuquí', lat: 5.7097, lng: -77.2714, kind: 'cabecera' },
  { name: 'Riosucio', municipality: 'Riosucio', lat: 7.4403, lng: -77.1186, kind: 'cabecera' },
  { name: 'Acandí', municipality: 'Acandí', lat: 8.5108, lng: -77.2789, kind: 'cabecera' },
  { name: 'Unguía', municipality: 'Unguía', lat: 8.0431, lng: -77.0925, kind: 'cabecera' },
  { name: 'Bellavista (Bojayá)', municipality: 'Bojayá', lat: 6.5586, lng: -76.8892, kind: 'cabecera' },
  { name: 'El Carmen de Atrato', municipality: 'El Carmen de Atrato', lat: 5.8989, lng: -76.1428, kind: 'cabecera' },
  { name: 'Lloró', municipality: 'Lloró', lat: 5.4972, lng: -76.5453, kind: 'cabecera' },
  { name: 'Yuto (Atrato)', municipality: 'Atrato', lat: 5.5311, lng: -76.6394, kind: 'cabecera' },
  { name: 'Beté (Medio Atrato)', municipality: 'Medio Atrato', lat: 5.9672, lng: -76.7836, kind: 'cabecera' },
  { name: 'Bagadó', municipality: 'Bagadó', lat: 5.4108, lng: -76.4156, kind: 'cabecera' },
  { name: 'Nóvita', municipality: 'Nóvita', lat: 4.9558, lng: -76.6089, kind: 'cabecera' },
  { name: 'Sipí', municipality: 'Sipí', lat: 4.6528, lng: -76.6433, kind: 'cabecera' },
  { name: 'Docordó (Litoral del San Juan)', municipality: 'El Litoral del San Juan', lat: 4.2581, lng: -77.3647, kind: 'cabecera' },
  { name: 'Pizarro (Bajo Baudó)', municipality: 'Bajo Baudó', lat: 4.9542, lng: -77.3656, kind: 'cabecera' },
  { name: 'Pie de Pató (Alto Baudó)', municipality: 'Alto Baudó', lat: 5.5153, lng: -76.9744, kind: 'cabecera' },
  { name: 'Puerto Meluk (Medio Baudó)', municipality: 'Medio Baudó', lat: 5.1919, lng: -76.9506, kind: 'cabecera' },
  { name: 'Managrú (El Cantón del San Pablo)', municipality: 'El Cantón del San Pablo', lat: 5.3375, lng: -76.6844, kind: 'cabecera' },
  { name: 'Cértegui', municipality: 'Cértegui', lat: 5.3717, lng: -76.6056, kind: 'cabecera' },
  { name: 'Las Ánimas (Unión Panamericana)', municipality: 'Unión Panamericana', lat: 5.2806, lng: -76.6297, kind: 'cabecera' },
  { name: 'Paimadó (Río Quito)', municipality: 'Río Quito', lat: 5.4867, lng: -76.7403, kind: 'cabecera' },
  { name: 'Juradó', municipality: 'Juradó', lat: 7.1047, lng: -77.7639, kind: 'cabecera' },
  { name: 'Curbaradó (Carmen del Darién)', municipality: 'Carmen del Darién', lat: 7.1603, lng: -76.9706, kind: 'cabecera' },
  { name: 'Andagoya (Medio San Juan)', municipality: 'Medio San Juan', lat: 5.0947, lng: -76.6961, kind: 'cabecera' },
  { name: 'Santa Rita (Río Iró)', municipality: 'Río Iró', lat: 5.1856, lng: -76.4975, kind: 'cabecera' },
  { name: 'Belén de Bajirá', municipality: 'Belén de Bajirá', lat: 7.3725, lng: -76.7158, kind: 'cabecera' },
  { name: 'Tutunendo', municipality: 'Quibdó', lat: 5.7442, lng: -76.5367, kind: 'referencia' },
  { name: 'Aeropuerto El Caraño', municipality: 'Quibdó', lat: 5.6908, lng: -76.6414, kind: 'referencia' },
  { name: 'Malecón de Quibdó (río Atrato)', municipality: 'Quibdó', lat: 5.6928, lng: -76.6622, kind: 'referencia' },
  { name: 'Hospital San Francisco de Asís', municipality: 'Quibdó', lat: 5.6894, lng: -76.6511, kind: 'referencia' },
  { name: 'Barrio Kennedy', municipality: 'Quibdó', lat: 5.6972, lng: -76.6447, kind: 'referencia' },
  { name: 'Barrio La Yesca', municipality: 'Quibdó', lat: 5.6853, lng: -76.6556, kind: 'referencia' },
  { name: 'Barrio Medrano', municipality: 'Quibdó', lat: 5.7011, lng: -76.6531, kind: 'referencia' },
  { name: 'Barrio Cabí', municipality: 'Quibdó', lat: 5.6992, lng: -76.6608, kind: 'referencia' },
  { name: 'Zona Minera', municipality: 'Quibdó', lat: 5.6861, lng: -76.6419, kind: 'referencia' },
  { name: 'Medellín', municipality: 'Antioquia', lat: 6.2442, lng: -75.5812, kind: 'vecino' },
  { name: 'Pereira', municipality: 'Risaralda', lat: 4.8133, lng: -75.6961, kind: 'vecino' },
  { name: 'Buenaventura', municipality: 'Valle del Cauca', lat: 3.8801, lng: -77.0312, kind: 'vecino' },
  { name: 'Turbo', municipality: 'Antioquia', lat: 8.0926, lng: -76.7282, kind: 'vecino' },
];

export const CHOCO_CENTER: [number, number] = [5.65, -76.75];
export const QUIBDO: [number, number] = [5.6919, -76.6583];
/** Límites para descarga offline de teselas y vista inicial. */
export const CHOCO_BOUNDS: [[number, number], [number, number]] = [
  [3.95, -77.95],
  [8.75, -76.0],
];

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function nearestPlace(lat: number, lng: number): { place: Place; km: number } {
  let best = PLACES[0];
  let bestD = Infinity;
  for (const p of PLACES) {
    if (p.kind === 'vecino') continue;
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { place: best, km: bestD };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

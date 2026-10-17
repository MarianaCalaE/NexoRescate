import type { OfficialAlert } from '../types';
import { SCENARIO } from '../data/seed';

/**
 * Arquitectura de adaptadores para alertas oficiales.
 * - DemoAlertsAdapter: datos SIMULADOS del escenario (SGC, IDEAM, DIMAR, UNGRD). No son reales.
 * - UsgsEarthquakeAdapter: feed GeoJSON público y real del USGS (sin clave). Solo con internet.
 * - Futuro: SgcAdapter, IdeamAdapter, DimarAdapter cuando existan integraciones verificadas.
 *   No se inventan endpoints: esos adaptadores se dejan sin implementar a propósito.
 */
export interface AlertsAdapter {
  id: string;
  name: string;
  simulated: boolean;
  requiresInternet: boolean;
  fetch(): Promise<OfficialAlert[]>;
}

export const DemoAlertsAdapter: AlertsAdapter = {
  id: 'demo',
  name: 'Escenario de demostración',
  simulated: true,
  requiresInternet: false,
  async fetch() {
    const now = Date.now();
    const m = (min: number) => now - min * 60_000;
    return [
      { id: 'AL-D01', kind: 'sismo', level: 'roja', title: `Sismo M${SCENARIO.magnitude} (hipotético)`, body: `Evento simulado. Profundidad ${SCENARIO.depthKm} km. Epicentro aproximado a 30 km al occidente de Quibdó. Se esperan réplicas.`, source: 'Servicio Geológico Colombiano (SIMULADO)', sourceShort: 'SGC · demo', location: 'Alto Baudó, Chocó', lat: SCENARIO.epicenter.lat, lng: SCENARIO.epicenter.lng, issuedAt: m(SCENARIO.minutesAgo - 4), updatedAt: m(25), simulated: true, magnitude: SCENARIO.magnitude, depthKm: SCENARIO.depthKm },
      { id: 'AL-D02', kind: 'sismo', level: 'amarilla', title: 'Réplica M4.7 (hipotética)', body: 'Réplica simulada sentida en Quibdó, Lloró y Alto Baudó.', source: 'Servicio Geológico Colombiano (SIMULADO)', sourceShort: 'SGC · demo', location: 'Alto Baudó, Chocó', lat: 5.66, lng: -76.88, issuedAt: m(58), updatedAt: m(50), simulated: true, magnitude: 4.7, depthKm: 22 },
      { id: 'AL-D03', kind: 'tsunami', level: 'informativa', title: 'Sin amenaza de tsunami (simulado)', body: 'Evaluación simulada: el evento no genera amenaza de tsunami para el litoral Pacífico. Mantenerse atento a comunicados oficiales.', source: 'DIMAR (SIMULADO)', sourceShort: 'DIMAR · demo', location: 'Litoral Pacífico chocoano', lat: 5.7, lng: -77.3, issuedAt: m(170), updatedAt: m(120), simulated: true },
      { id: 'AL-D04', kind: 'lluvia', level: 'naranja', title: 'Alerta naranja por lluvias e inundación', body: 'Aumento de niveles en los ríos Atrato y San Juan por lluvias persistentes (simulado).', source: 'IDEAM (SIMULADO)', sourceShort: 'IDEAM · demo', location: 'Cuencas Atrato y San Juan', lat: 5.69, lng: -76.66, issuedAt: m(130), updatedAt: m(15), simulated: true },
      { id: 'AL-D05', kind: 'deslizamiento', level: 'roja', title: 'Alerta roja por deslizamientos', body: 'Alta probabilidad de movimientos en masa en la vía Quibdó–Medellín y laderas de Tadó (simulado).', source: 'IDEAM (SIMULADO)', sourceShort: 'IDEAM · demo', location: 'Vía Quibdó–Medellín y Tadó', lat: 5.75, lng: -76.52, issuedAt: m(150), updatedAt: m(30), simulated: true },
      { id: 'AL-D06', kind: 'meteo', level: 'amarilla', title: 'Tormentas eléctricas en la tarde', body: 'Pronóstico simulado de tormentas y ráfagas de viento en el centro del departamento.', source: 'IDEAM (SIMULADO)', sourceShort: 'IDEAM · demo', location: 'Centro del Chocó', issuedAt: m(240), updatedAt: m(90), simulated: true },
      { id: 'AL-D07', kind: 'meteo', level: 'informativa', title: 'Recomendaciones para albergues', body: 'Recomendaciones simuladas de la gestión del riesgo para puntos de encuentro y albergues temporales.', source: 'UNGRD (SIMULADO)', sourceShort: 'UNGRD · demo', location: 'Departamento del Chocó', issuedAt: m(110), updatedAt: m(110), simulated: true },
    ] satisfies OfficialAlert[];
  },
};

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson';
/** Región: Colombia, Panamá y Pacífico cercano. */
const REGION = { minLat: -2, maxLat: 13.5, minLng: -82, maxLng: -66 };

export const UsgsEarthquakeAdapter: AlertsAdapter = {
  id: 'usgs',
  name: 'USGS — sismos reales (M2.5+, 30 días)',
  simulated: false,
  requiresInternet: true,
  async fetch() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await fetch(USGS_URL, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        features: { id: string; properties: { mag: number; place: string; time: number; updated: number; url: string; tsunami: number }; geometry: { coordinates: [number, number, number] } }[];
      };
      return data.features
        .filter((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return lat >= REGION.minLat && lat <= REGION.maxLat && lng >= REGION.minLng && lng <= REGION.maxLng;
        })
        .map(
          (f): OfficialAlert => ({
            id: 'USGS-' + f.id,
            kind: 'sismo',
            level: f.properties.mag >= 6 ? 'roja' : f.properties.mag >= 5 ? 'naranja' : f.properties.mag >= 4 ? 'amarilla' : 'informativa',
            title: `Sismo real M${f.properties.mag.toFixed(1)}`,
            body: f.properties.place + (f.properties.tsunami ? ' · USGS marca posible relevancia de tsunami: consulte DIMAR/SGC.' : ''),
            source: 'United States Geological Survey (USGS) — dato real',
            sourceShort: 'USGS · real',
            location: f.properties.place,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            issuedAt: f.properties.time,
            updatedAt: f.properties.updated,
            simulated: false,
            url: f.properties.url,
            magnitude: f.properties.mag,
            depthKm: f.geometry.coordinates[2],
          }),
        )
        .sort((a, b) => b.issuedAt - a.issuedAt);
    } finally {
      clearTimeout(t);
    }
  },
};

/** Placeholders documentados: requieren integración verificada antes de implementarse. */
export const PENDING_SOURCES = [
  { name: 'Servicio Geológico Colombiano (SGC)', scope: 'Sismicidad y volcanes', status: 'Pendiente de integración verificada' },
  { name: 'IDEAM', scope: 'Lluvias, niveles de ríos, pronósticos', status: 'Pendiente de integración verificada' },
  { name: 'DIMAR', scope: 'Alertas de tsunami y condiciones marítimas', status: 'Pendiente de integración verificada' },
  { name: 'UNGRD', scope: 'Boletines de gestión del riesgo', status: 'Pendiente de integración verificada' },
];

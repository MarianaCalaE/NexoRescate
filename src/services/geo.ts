import L from 'leaflet';
import { PLACES, normalize, nearestPlace, type Place } from '../data/places';

export const TILE_CACHE = 'nr-tiles-v1';

export interface BaseLayerDef {
  id: 'calles' | 'satelite' | 'topo' | 'local' | 'oscuro';
  label: string;
  url?: string;
  labelsUrl?: string;
  subdomains?: string;
  maxZoom: number;
  attribution: string;
  /** Proveedores alternos si el principal no responde (p. ej. el archivo se abrió sin servidor web). */
  fallbacks?: { url: string; subdomains?: string; attribution: string }[];
}

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>`;
const ESRI_ATTR = 'Mapa &copy; Esri';

/*
 * Proveedor principal + alternos. OpenStreetMap exige que la página tenga dirección web (Referer):
 * si el HTML se abre con doble clic (file://) rechaza las teselas. CARTO y Esri no lo exigen,
 * por eso van primero o como respaldo automático.
 */
export const BASE_LAYERS: BaseLayerDef[] = [
  {
    id: 'calles',
    label: 'Calles',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: CARTO_ATTR,
    fallbacks: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: ESRI_ATTR },
      { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR },
    ],
  },
  {
    id: 'satelite',
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics',
  },
  {
    id: 'topo',
    label: 'Relieve',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Relieve &copy; Esri',
    fallbacks: [{ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', subdomains: 'abc', attribution: '&copy; OpenStreetMap, SRTM, OpenTopoMap' }],
  },
  {
    id: 'oscuro',
    label: 'Noche',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: CARTO_ATTR,
    fallbacks: [{ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: ESRI_ATTR }],
  },
  {
    id: 'local',
    label: 'Local offline',
    maxZoom: 16,
    attribution: 'Natural Earth · ríos/vías aprox.',
  },
];

const hasCaches = typeof caches !== 'undefined';

/**
 * Capa de teselas con caché persistente (Cache API):
 *  - Con internet: descarga la tesela, la guarda en caché y la muestra.
 *  - Sin internet (real o modo demo): solo muestra teselas ya guardadas; el resto queda
 *    transparente y deja ver la cartografía vectorial local que está debajo.
 */
export const CachedTileLayer = L.TileLayer.extend({
  options: { cacheOnly: false },
  createTile(this: L.TileLayer & { options: { cacheOnly: boolean } }, coords: L.Coords, done: L.DoneCallback) {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');
    img.decoding = 'async';
    const url = this.getTileUrl(coords);
    const fail = () => {
      img.style.visibility = 'hidden';
      done(new Error('tesela no disponible'), img);
    };
    img.onload = () => done(undefined, img);
    img.onerror = fail;
    const cacheOnly = this.options.cacheOnly || !navigator.onLine;
    if (!hasCaches) {
      if (cacheOnly) fail();
      else img.src = url;
      return img;
    }
    caches
      .open(TILE_CACHE)
      .then(async (cache) => {
        const hit = await cache.match(url);
        if (hit) {
          img.src = URL.createObjectURL(await hit.blob());
          img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
          return;
        }
        if (cacheOnly) return fail();
        try {
          const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (!res.ok) throw new Error(String(res.status));
          cache.put(url, res.clone()).catch(() => {});
          img.src = URL.createObjectURL(await res.blob());
          img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
        } catch {
          img.src = url; // último recurso: carga directa (sin caché)
        }
      })
      .catch(() => (cacheOnly ? fail() : (img.src = url)));
    return img;
  },
}) as unknown as new (url: string, opts: L.TileLayerOptions & { cacheOnly?: boolean }) => L.TileLayer & {
  options: { cacheOnly: boolean };
};

function lng2tile(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
function lat2tile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

export function tileUrls(def: BaseLayerDef, bounds: L.LatLngBounds, zMin: number, zMax: number, max = 450) {
  const urls: string[] = [];
  const tpls = [def.url, def.labelsUrl].filter(Boolean) as string[];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lng2tile(bounds.getWest(), z);
    const x1 = lng2tile(bounds.getEast(), z);
    const y0 = lat2tile(bounds.getNorth(), z);
    const y1 = lat2tile(bounds.getSouth(), z);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (const t of tpls) {
          const s = def.subdomains ? def.subdomains[(x + y) % def.subdomains.length] : '';
          urls.push(t.replace('{s}', s).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
          if (urls.length >= max) return urls;
        }
  }
  return urls;
}

/**
 * Guarda para uso offline las teselas del área visible (zoom actual y dos niveles más).
 * Limitado a un máximo de teselas para respetar las políticas de uso de los proveedores
 * (OSM prohíbe descargas masivas). Producción: servidor propio o paquete PMTiles/MBTiles.
 */
export async function saveAreaOffline(def: BaseLayerDef, bounds: L.LatLngBounds, zoom: number, onProgress: (done: number, total: number) => void) {
  if (!def.url || !hasCaches) return { saved: 0, total: 0 };
  const urls = tileUrls(def, bounds, Math.max(5, zoom - 1), Math.min(def.maxZoom, zoom + 2));
  const cache = await caches.open(TILE_CACHE);
  let done = 0;
  let saved = 0;
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const u = queue.shift()!;
      try {
        if (!(await cache.match(u))) {
          const r = await fetch(u, { mode: 'cors', credentials: 'omit' });
          if (r.ok) {
            await cache.put(u, r);
            saved++;
          }
        } else saved++;
      } catch {
        /* ignorar tesela fallida */
      }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { saved, total: urls.length };
}

export async function cachedTileCount() {
  if (!hasCaches) return 0;
  try {
    return (await (await caches.open(TILE_CACHE)).keys()).length;
  } catch {
    return 0;
  }
}

export interface GeoResult {
  name: string;
  detail: string;
  lat: number;
  lng: number;
  source: 'local' | 'osm';
  bbox?: [number, number, number, number];
}

export function searchLocal(q: string): GeoResult[] {
  const n = normalize(q.trim());
  if (n.length < 2) return [];
  return PLACES.filter((p) => normalize(p.name).includes(n) || normalize(p.municipality).includes(n))
    .slice(0, 6)
    .map((p: Place) => ({
      name: p.name,
      detail: p.kind === 'vecino' ? p.municipality : `${p.municipality}, Chocó`,
      lat: p.lat,
      lng: p.lng,
      source: 'local' as const,
    }));
}

/**
 * Geocodificación real con OpenStreetMap Nominatim (sin clave). Política de uso:
 * máx. 1 consulta/segundo, por eso la búsqueda se dispara con debounce y al confirmar.
 */
export async function searchNominatim(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('q', q);
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('countrycodes', 'co');
  u.searchParams.set('limit', '6');
  u.searchParams.set('accept-language', 'es');
  u.searchParams.set('viewbox', '-78.2,8.9,-75.8,3.9');
  u.searchParams.set('addressdetails', '0');
  const r = await fetch(u, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const data = (await r.json()) as { display_name: string; name: string; lat: string; lon: string; boundingbox: string[] }[];
  return data.map((d) => ({
    name: d.name || d.display_name.split(',')[0],
    detail: d.display_name.split(',').slice(1, 4).join(',').trim(),
    lat: +d.lat,
    lng: +d.lon,
    source: 'osm',
    bbox: d.boundingbox ? [+d.boundingbox[0], +d.boundingbox[1], +d.boundingbox[2], +d.boundingbox[3]] : undefined,
  }));
}

let lastReverse = 0;
export async function reverseGeocode(lat: number, lng: number): Promise<{ label: string; municipality: string; source: 'osm' | 'local' }> {
  const local = () => {
    const { place, km } = nearestPlace(lat, lng);
    return {
      label: km < 1.2 ? `Cerca de ${place.name}` : `${km.toFixed(1)} km de ${place.name}`,
      municipality: place.municipality,
      source: 'local' as const,
    };
  };
  if (!navigator.onLine || Date.now() - lastReverse < 1100) return local();
  lastReverse = Date.now();
  try {
    const u = new URL('https://nominatim.openstreetmap.org/reverse');
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lng));
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('zoom', '17');
    u.searchParams.set('accept-language', 'es');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(u, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error();
    const d = (await r.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    if (!d.address) return local();
    const a = d.address;
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const area = a.neighbourhood || a.suburb || a.hamlet || a.village || a.quarter || '';
    const mun = a.city || a.town || a.municipality || a.county || a.village || local().municipality;
    const label = [street, area].filter(Boolean).join(', ') || d.display_name?.split(',').slice(0, 2).join(',') || mun;
    return { label, municipality: mun, source: 'osm' };
  } catch {
    return local();
  }
}

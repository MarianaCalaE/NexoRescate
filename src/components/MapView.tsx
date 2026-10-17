import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { renderToStaticMarkup } from 'react-dom/server';
import { useApp } from '../store';
import type { Incident, OfficialAlert } from '../types';
import { CAT } from '../data/categories';
import { LEVEL_META, LEVEL_ORDER, type DisplayLevel } from '../lib/priority';
import { BASE_LAYERS, CachedTileLayer, type BaseLayerDef } from '../services/geo';
import { UNITS } from '../data/units';
import { PLACES } from '../data/places';
import { SCENARIO } from '../data/seed';
import offlineGeo from '../data/choco-ne.json';
import { APPROX_RIVERS } from '../data/rivers';

const iconCache = new Map<string, string>();
function catSvg(id: Incident['category'], size = 16) {
  const k = id + size;
  if (!iconCache.has(k)) {
    const Icon = CAT[id].icon;
    iconCache.set(k, renderToStaticMarkup(<Icon size={size} color="#fff" strokeWidth={2.4} />));
  }
  return iconCache.get(k)!;
}

function pinIcon(inc: Incident, level: DisplayLevel, dupCount: number, selected: boolean, ops: boolean) {
  const cat = CAT[inc.category];
  const lv = LEVEL_META[level];
  const size = selected ? 48 : ops ? 36 : 40;
  const cls = ['nr-pin', `lv-${level}`, ops ? 'ops' : 'citizen', selected ? 'is-sel' : '', inc.attention === 'resuelto' ? 'is-done' : ''].join(' ');
  const html = `<div class="${cls}" style="--c:${cat.color};--p:${ops ? lv.color : cat.color};--s:${size}px">
      <div class="nr-pin-head"><div class="nr-pin-ico">${catSvg(inc.category, selected ? 22 : 17)}</div></div>
      ${ops && inc.attention !== 'resuelto' ? `<span class="nr-lv" title="${lv.label}">${dupCount ? lv.glyph + ' +' + dupCount : lv.glyph}</span>` : ''}
      ${inc.attention === 'resuelto' ? '<span class="nr-done">✓</span>' : ''}
      ${inc.mine ? '<span class="nr-mine">Tú</span>' : ''}
    </div>`;
  return L.divIcon({ html, className: 'nr-pin-wrap', iconSize: [size, size + 8], iconAnchor: [size / 2, size + 6], popupAnchor: [0, -size] });
}

type LevelMarker = L.Marker & { options: L.MarkerOptions & { level?: DisplayLevel } };

// Estilos de la cartografía local vía clases CSS (dependen del tema claro u oscuro).
const KIND_STYLE: Record<string, L.PathOptions> = {
  pais: { className: 'nr-k-pais', weight: 0.8, fillOpacity: 1 },
  dpto: { className: 'nr-k-dpto', weight: 1, dashArray: '4 3', fill: false },
  choco: { className: 'nr-k-choco', weight: 1.6, fillOpacity: 1 },
  rio: { className: 'nr-k-rio', weight: 2.4 },
  rio_aprox: { className: 'nr-k-rio', weight: 2, dashArray: '6 4' },
  via: { className: 'nr-k-via', weight: 2 },
};

export function MapView({
  incidents,
  onMap,
  variant = 'ops',
  baseLayer,
  showUnits = false,
}: {
  incidents: Incident[];
  onMap?: (m: L.Map) => void;
  variant?: 'citizen' | 'ops';
  baseLayer: BaseLayerDef['id'];
  showUnits?: boolean;
}) {
  const ops = variant === 'ops';
  const baseRef = useRef(baseLayer);
  baseRef.current = baseLayer;
  /** Vista simplificada: sin teselas disponibles (sin internet o servidor bloqueado). */
  const [simple, setSimple] = useState(baseLayer === 'local');
  /** Índice del proveedor en uso: 0 = principal, 1+ = alternos. */
  const [provider, setProvider] = useState(0);
  useEffect(() => setProvider(0), [baseLayer]);
  const simpleRef = useRef(simple);
  simpleRef.current = simple;
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{
    base?: L.TileLayer;
    labels?: L.TileLayer;
    vector?: L.GeoJSON;
    towns?: L.LayerGroup;
    refs?: L.LayerGroup;
    outline?: L.GeoJSON;
    cluster?: L.MarkerClusterGroup;
    user?: L.LayerGroup;
    pick?: L.Marker;
    usgs?: L.LayerGroup;
    scenario?: L.LayerGroup;
    units?: L.LayerGroup;
  }>({});
  const app = useApp();
  const appRef = useRef(app);
  appRef.current = app;

  // —— Crear mapa ——
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 19,
      maxBounds: L.latLngBounds([-6, -92], [16, -60]),
      worldCopyJump: false,
      tapTolerance: 20,
    }).setView([5.6, -76.75], 9);
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m);
    m.createPane('vectorBase').style.zIndex = '150';
    m.createPane('vectorTop').style.zIndex = '390';
    m.getPane('vectorTop')!.style.pointerEvents = 'none';

    // Cartografía vectorial local (siempre disponible, sin internet)
    const fc = offlineGeo as unknown as GeoJSON.FeatureCollection;
    const all: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [...fc.features, ...APPROX_RIVERS.features] };
    layers.current.vector = L.geoJSON(all, {
      pane: 'vectorBase',
      interactive: false,
      style: (f) => KIND_STYLE[(f?.properties as { kind: string }).kind] ?? {},
    }).addTo(m);
    layers.current.outline = L.geoJSON(
      { type: 'FeatureCollection', features: fc.features.filter((f) => (f.properties as { kind: string }).kind === 'choco') } as GeoJSON.FeatureCollection,
      { pane: 'vectorTop', interactive: false, style: { className: 'nr-k-outline', weight: 2, dashArray: '8 6', fill: false } },
    ).addTo(m);
    layers.current.towns = L.layerGroup(
      PLACES.filter((p) => p.kind !== 'referencia').map((p) =>
        L.marker([p.lat, p.lng], {
          pane: 'vectorTop',
          interactive: false,
          keyboard: false,
          icon: L.divIcon({ className: 'nr-town', html: `<span class="${p.kind}">${p.name.split(' (')[0]}</span>`, iconSize: [0, 0] }),
        }),
      ),
    );

    layers.current.refs = L.layerGroup(
      PLACES.filter((p) => p.kind === 'referencia').map((p) =>
        L.marker([p.lat, p.lng], {
          pane: 'vectorTop',
          interactive: false,
          keyboard: false,
          icon: L.divIcon({ className: 'nr-town nr-ref', html: `<span class="referencia">${p.name}</span>`, iconSize: [0, 0] }),
        }),
      ),
    );

    // Escenario simulado: epicentro hipotético
    const ep = SCENARIO.epicenter;
    layers.current.scenario = L.layerGroup([
      ...[20, 50, 100].map((km) =>
        L.circle([ep.lat, ep.lng], { radius: km * 1000, color: '#9A3412', weight: 1, opacity: 0.5, dashArray: '4 6', fillColor: '#F97316', fillOpacity: km === 20 ? 0.06 : 0.025, interactive: false }),
      ),
      L.marker([ep.lat, ep.lng], {
        icon: L.divIcon({ className: '', html: `<div class="nr-epi"><span></span><b>M${SCENARIO.magnitude}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
        zIndexOffset: -500,
      }).bindPopup(
        `<div class="nr-pop"><div class="tag sim">Escenario simulado</div><b>Sismo hipotético M${SCENARIO.magnitude}</b><br/>Profundidad ${SCENARIO.depthKm} km · Alto Baudó<br/><small>Anillos: 20, 50 y 100 km. No es un evento real.</small></div>`,
      ),
    ]);
    if (ops) layers.current.scenario.addTo(m);

    // Clúster de incidentes
    layers.current.cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: (z) => (z >= 14 ? 30 : 50),
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (c) => {
        const children = c.getAllChildMarkers() as LevelMarker[];
        let worst: DisplayLevel = 'atendido';
        for (const ch of children) {
          const l = ch.options.level ?? 'baja';
          if (LEVEL_ORDER.indexOf(l) < LEVEL_ORDER.indexOf(worst)) worst = l;
        }
        const n = c.getChildCount();
        const s = n > 15 ? 52 : n > 6 ? 46 : 40;
        return L.divIcon({
          html: `<div class="nr-cluster ${ops ? 'ops' : 'citizen'}" style="--p:${LEVEL_META[worst].color};--s:${s}px"><b>${n}</b></div>`,
          className: 'nr-cluster-wrap',
          iconSize: [s, s],
        });
      },
    }).addTo(m);

    layers.current.user = L.layerGroup().addTo(m);
    layers.current.usgs = L.layerGroup();

    const updateTowns = () => {
      const local = simpleRef.current || baseRef.current === 'local';
      const show = m.getZoom() >= 8 && local;
      if (show && !m.hasLayer(layers.current.towns!)) layers.current.towns!.addTo(m);
      if (!show && m.hasLayer(layers.current.towns!)) m.removeLayer(layers.current.towns!);
      const showRefs = m.getZoom() >= 12 && local;
      if (showRefs && !m.hasLayer(layers.current.refs!)) layers.current.refs!.addTo(m);
      if (!showRefs && m.hasLayer(layers.current.refs!)) m.removeLayer(layers.current.refs!);
    };
    m.on('zoomend', updateTowns);
    (m as L.Map & { _nrUpdateTowns?: () => void })._nrUpdateTowns = updateTowns;

    m.on('click', (e: L.LeafletMouseEvent) => {
      const a = appRef.current;
      if (a.pick.active) a.setPick({ active: true, lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
      else a.select(null);
    });

    map.current = m;
    onMap?.(m);
    const t = setTimeout(() => map.current === m && m.invalidateSize(), 50);
    const ro = new ResizeObserver(() => map.current === m && m.invalidateSize());
    ro.observe(el.current);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      m.stop();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— Capa base ——
  const baseId = baseLayer;
  const offline = !app.online;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.base?.remove();
    layers.current.labels?.remove();
    layers.current.base = layers.current.labels = undefined;
    const base = BASE_LAYERS.find((b) => b.id === baseId)!;
    const alt = provider > 0 ? base.fallbacks?.[provider - 1] : undefined;
    const def = alt ? { ...base, url: alt.url, subdomains: alt.subdomains, attribution: alt.attribution, labelsUrl: base.labelsUrl, tileClass: alt.tileClass, maxZoom: alt.tileClass ? 19 : base.maxZoom } : base;
    const hasNext = !offline && provider < (base.fallbacks?.length ?? 0);
    el.current!.dataset.base = baseId;
    el.current!.dataset.offline = String(offline);
    if (def.url) {
      layers.current.base = new CachedTileLayer(def.url, {
        maxZoom: def.maxZoom,
        maxNativeZoom: def.maxZoom,
        subdomains: def.subdomains ?? 'abc',
        attribution: def.attribution + (offline ? ', solo zonas guardadas' : ''),
        cacheOnly: offline,
        crossOrigin: true,
        keepBuffer: 3,
        className: def.tileClass ?? '',
      }).addTo(m);
      // Si las teselas no cargan (sin internet o bloqueadas), pasar a la vista simplificada local.
      let errors = 0;
      let loads = 0;
      setSimple(false);
      let switched = false;
      const giveUp = () => {
        if (switched || loads > 0) return;
        switched = true;
        // Probar el siguiente proveedor; si no hay más, vista simplificada local.
        if (hasNext) setProvider((p) => p + 1);
        else setSimple(true);
      };
      layers.current.base.on('tileerror', () => {
        errors++;
        if (errors >= 4) giveUp();
      });
      layers.current.base.on('tileload', () => {
        loads++;
        setSimple(false);
      });
      // Si en 4 s no cargó ninguna tesela, también se usa la vista simplificada.
      const slow = setTimeout(giveUp, 4000);
      layers.current.base.once('remove', () => clearTimeout(slow));
      if (def.labelsUrl)
        layers.current.labels = new CachedTileLayer(def.labelsUrl, { maxZoom: def.maxZoom, cacheOnly: offline, pane: 'overlayPane' }).addTo(m);
    } else {
      m.attributionControl.addAttribution(def.attribution);
      setSimple(true);
    }
    m.setMaxZoom(def.maxZoom);
    (m as L.Map & { _nrUpdateTowns?: () => void })._nrUpdateTowns?.();
    return () => {
      if (!def.url) m.attributionControl.removeAttribution(def.attribution);
    };
  }, [baseId, offline, provider]);

  // —— Vista simplificada: más referencias y zoom limitado para no mostrar un mapa vacío ——
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    el.current!.dataset.simple = String(simple);
    const def = BASE_LAYERS.find((b) => b.id === baseLayer)!;
    const cap = simple ? 15 : def.maxZoom;
    m.setMaxZoom(cap);
    if (m.getZoom() > cap) m.setZoom(cap);
    (m as L.Map & { _nrUpdateTowns?: () => void })._nrUpdateTowns?.();
  }, [simple, baseLayer]);

  // —— Marcadores ——
  useEffect(() => {
    const cl = layers.current.cluster;
    if (!cl) return;
    cl.clearLayers();
    const ms: L.Marker[] = [];
    for (const inc of incidents) {
      if (inc.lat == null || inc.lng == null) continue;
      const a = app.assessments.get(inc.id);
      const level = a?.display ?? 'baja';
      const sel = inc.id === app.selectedId;
      const mk = L.marker([inc.lat, inc.lng], {
        icon: pinIcon(inc, level, app.duplicatesOf.get(inc.id)?.length ?? 0, sel, ops),
        zIndexOffset: sel ? 2000 : (6 - LEVEL_ORDER.indexOf(level)) * 100,
        title: ops ? `${CAT[inc.category].label}, prioridad ${LEVEL_META[level].label.toLowerCase()}` : CAT[inc.category].label,
        riseOnHover: true,
        keyboard: true,
      }) as LevelMarker;
      mk.options.level = level;
      mk.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (appRef.current.pick.active) return;
        appRef.current.select(inc.id);
      });
      ms.push(mk);
    }
    cl.addLayers(ms);
  }, [incidents, app.assessments, app.selectedId, app.duplicatesOf]);

  // —— Llevar a un punto ——
  useEffect(() => {
    const t = app.flyTarget;
    if (t && map.current) {
      const z = Math.min(t.zoom ?? Math.max(map.current.getZoom(), 14), map.current.getMaxZoom());
      map.current.flyTo([t.lat, t.lng], z, { duration: 0.9 });
    }
  }, [app.flyTarget]);

  // Si se selecciona un incidente dentro de un clúster, abrirlo
  useEffect(() => {
    const id = app.selectedId;
    const m = map.current;
    if (!id || !m) return;
    const inc = incidents.find((i) => i.id === id);
    if (!inc || inc.lat == null || inc.lng == null) return;
    const ll = L.latLng(inc.lat, inc.lng);
    if (!m.getBounds().pad(-0.15).contains(ll)) m.panTo(ll, { animate: true });
  }, [app.selectedId, incidents]);

  // —— Ubicación del usuario ——
  useEffect(() => {
    const g = layers.current.user;
    if (!g) return;
    g.clearLayers();
    const p = app.userPos;
    if (!p) return;
    L.circle([p.lat, p.lng], { radius: p.accuracy, color: '#2563EB', weight: 1, fillColor: '#3B82F6', fillOpacity: 0.12, interactive: false }).addTo(g);
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: '<div class="nr-me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      zIndexOffset: 3000,
      title: `Tu ubicación (±${Math.round(p.accuracy)} m)`,
    }).addTo(g);
  }, [app.userPos]);

  // —— Punto elegido manualmente ——
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    el.current!.classList.toggle('picking', app.pick.active);
    const { lat, lng, active } = app.pick;
    if (!active || lat == null || lng == null) {
      layers.current.pick?.remove();
      layers.current.pick = undefined;
      return;
    }
    if (!layers.current.pick) {
      layers.current.pick = L.marker([lat, lng], {
        draggable: true,
        autoPan: true,
        zIndexOffset: 4000,
        icon: L.divIcon({ className: '', html: '<div class="nr-pick"><span></span></div>', iconSize: [40, 52], iconAnchor: [20, 50] }),
      })
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          appRef.current.setPick({ active: true, lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
        })
        .addTo(m);
    } else layers.current.pick.setLatLng([lat, lng]);
  }, [app.pick]);

  // —— Unidades de respuesta (solo equipos) ——
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.units?.remove();
    if (!showUnits) return;
    const busy = new Map<string, Incident>();
    for (const i of app.incidents) if (i.assignedTo && i.attention !== 'resuelto' && i.lat != null) busy.set(i.assignedTo, i);
    layers.current.units = L.layerGroup(
      UNITS.map((u) => {
        const target = busy.get(u.id);
        // Las unidades asignadas se dibujan cerca de su caso (posición simulada).
        const pos: [number, number] = target ? [target.lat! + 0.0012, target.lng! + 0.0012] : [u.lat, u.lng];
        return L.marker(pos, {
          icon: L.divIcon({ className: '', html: `<div class="nr-unit" title="${u.name}">${u.short}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
          zIndexOffset: 1500,
        }).bindPopup(`<div class="nr-pop"><div class="tag sim">Unidad simulada</div><b>${u.name}</b><br/>${u.members} integrantes<br/>${target ? `Atendiendo ${target.id}` : 'Disponible en base'}</div>`);
      }),
    ).addTo(m);
  }, [showUnits, app.incidents]);

  // —— Sismos reales USGS ——
  useEffect(() => {
    const m = map.current;
    const g = layers.current.usgs;
    if (!m || !g) return;
    g.clearLayers();
    if (!app.settings.showUsgs) {
      g.remove();
      return;
    }
    app.usgs.items.forEach((q: OfficialAlert) => {
      if (q.lat == null || q.lng == null) return;
      const mag = q.magnitude ?? 3;
      L.circleMarker([q.lat, q.lng], {
        radius: 4 + (mag - 2.5) * 3.2,
        color: '#7F1D1D',
        weight: 1.5,
        fillColor: mag >= 5 ? '#DC2626' : mag >= 4 ? '#F97316' : '#FBBF24',
        fillOpacity: 0.55,
      })
        .bindPopup(
          `<div class="nr-pop"><div class="tag real">Dato real del USGS</div><b>M${mag.toFixed(1)}</b> · ${q.depthKm?.toFixed(0)} km de profundidad<br/>${q.location}<br/><small>${new Date(q.issuedAt).toLocaleString('es-CO')}</small>${q.url ? `<br/><a href="${q.url}" target="_blank" rel="noopener">Ver en USGS ↗</a>` : ''}</div>`,
        )
        .addTo(g);
    });
    g.addTo(m);
  }, [app.settings.showUsgs, app.usgs.items]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="nr-map h-full w-full" role="application" aria-label="Mapa interactivo de incidentes" />
      {simple && baseLayer !== 'local' && (
        <div className="pointer-events-none absolute bottom-[calc(var(--map-bottom)+26px)] left-2 z-[450] rounded-lg bg-surface/90 px-2 py-1 text-xs font-semibold text-ink-2 shadow-card">
          Mapa sin conexión: vista simplificada
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import {
  Search, Layers, LocateFixed, Plus, Minus, SlidersHorizontal, X, MapPin, ChevronRight, Download, Navigation, Check,
  Loader2, Activity, MapPinOff, Satellite, Map as MapIcon, Mountain, WifiOff, Moon,
} from 'lucide-react';
import { MapView } from '../components/MapView';
import { useApp } from '../store';
import { CATEGORIES, CAT } from '../data/categories';
import { LEVEL_META, type DisplayLevel } from '../lib/priority';
import { BASE_LAYERS, saveAreaOffline, searchLocal, searchNominatim, cachedTileCount, type GeoResult } from '../services/geo';
import { normalize } from '../data/places';
import { cx, LevelBadge, VerifBadge, CatIcon, timeAgo, Sheet, Chip, SimTag, RealTag, Btn } from '../components/ui';
import type { Incident, CategoryId } from '../types';

export interface MapFilters {
  cats: CategoryId[];
  levels: DisplayLevel[];
  status: 'todos' | 'activos' | 'resueltos';
  verif: 'todos' | 'verificados' | 'sin_verificar';
  mine: boolean;
}
const initialFilters: MapFilters = { cats: [], levels: [], status: 'activos', verif: 'todos', mine: false };

export function MapScreen({ visible }: { visible: boolean }) {
  const app = useApp();
  const mapRef = useRef<L.Map | null>(null);
  const [filters, setFilters] = useState<MapFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [noLoc, setNoLoc] = useState(false);
  const [locating, setLocating] = useState(false);

  const primaries = useMemo(() => app.incidents.filter((i) => !i.duplicateOf), [app.incidents]);
  const filtered = useMemo(
    () =>
      primaries.filter((i) => {
        const a = app.assessments.get(i.id);
        if (filters.cats.length && !filters.cats.includes(i.category)) return false;
        if (filters.levels.length && a && !filters.levels.includes(a.display)) return false;
        if (filters.status === 'activos' && i.attention === 'resuelto') return false;
        if (filters.status === 'resueltos' && i.attention !== 'resuelto') return false;
        if (filters.verif === 'verificados' && i.verification !== 'verificado_oficial') return false;
        if (filters.verif === 'sin_verificar' && i.verification === 'verificado_oficial') return false;
        if (filters.mine && !i.mine) return false;
        return true;
      }),
    [primaries, filters, app.assessments],
  );
  const withoutLocation = filtered.filter((i) => i.lat == null);
  const activeFilterCount =
    filters.cats.length + filters.levels.length + (filters.status !== 'activos' ? 1 : 0) + (filters.verif !== 'todos' ? 1 : 0) + (filters.mine ? 1 : 0);

  const selected = app.selectedId ? app.incidents.find((i) => i.id === app.selectedId) : null;

  const locateMe = async () => {
    setLocating(true);
    const p = await app.locate();
    setLocating(false);
    if (p) app.flyTo(p.lat, p.lng, 15);
  };

  const quick = (lv: DisplayLevel) =>
    setFilters((f) => ({ ...f, levels: f.levels.includes(lv) ? f.levels.filter((x) => x !== lv) : [...f.levels, lv] }));

  return (
    <div className={cx('absolute inset-0', !visible && 'pointer-events-none')} aria-hidden={!visible}>
      <MapView incidents={filtered} onMap={(m) => (mapRef.current = m)} variant="ops" baseLayer={app.settings.opsBaseLayer} showUnits />

      {visible && !app.pick.active && (
        <>
          {/* Buscador + filtros */}
          <div className={cx('pointer-events-none absolute inset-x-0 z-[560] px-3 lg:left-3 lg:right-auto lg:w-[420px] lg:px-0', app.online ? 'top-[calc(64px+var(--safe-t))] lg:top-[64px]' : 'top-[calc(98px+var(--safe-t))] lg:top-[98px]')}>
            <div className="pointer-events-auto">
              <SearchBox onPickIncident={(id) => app.select(id, true)} />
            </div>
            <div className="no-scrollbar pointer-events-auto mt-2 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setShowFilters(true)}
                className={cx(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-card',
                  activeFilterCount ? 'bg-brand text-on-brand' : 'bg-surface text-ink',
                )}
              >
                <SlidersHorizontal size={14} /> Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </button>
              {(['critica', 'alta', 'pendiente_verificacion', 'moderada'] as DisplayLevel[]).map((lv) => (
                <span key={lv} className="shadow-card rounded-full">
                  <Chip active={filters.levels.includes(lv)} onClick={() => quick(lv)} color={LEVEL_META[lv].color}>
                    {lv === 'pendiente_verificacion' ? 'Por verificar' : LEVEL_META[lv].label}
                  </Chip>
                </span>
              ))}
              <span className="shadow-card rounded-full">
                <Chip active={filters.status === 'resueltos'} onClick={() => setFilters((f) => ({ ...f, status: f.status === 'resueltos' ? 'activos' : 'resueltos' }))} color="#16A34A">
                  Atendidos
                </Chip>
              </span>
              <span className="shadow-card rounded-full">
                <Chip active={filters.mine} onClick={() => setFilters((f) => ({ ...f, mine: !f.mine, status: 'todos' }))} color="#2563EB">
                  Míos
                </Chip>
              </span>
            </div>
          </div>

          {/* Controles del mapa */}
          <div className={cx('absolute right-3 z-[500] flex flex-col gap-2', app.online ? 'top-[calc(168px+var(--safe-t))]' : 'top-[calc(202px+var(--safe-t))]')}>
            <MapBtn label="Capas del mapa" onClick={() => setShowLayers(true)}>
              <Layers size={20} />
            </MapBtn>
            <MapBtn label="Mi ubicación" onClick={locateMe} active={!!app.userPos}>
              {locating ? <Loader2 size={20} className="animate-spin" /> : <LocateFixed size={20} />}
            </MapBtn>
            <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
              <button aria-label="Acercar" className="grid h-11 w-11 place-items-center text-ink hover:bg-surface-2" onClick={() => mapRef.current?.zoomIn()}>
                <Plus size={20} />
              </button>
              <div className="mx-2 h-px bg-surface-3" />
              <button aria-label="Alejar" className="grid h-11 w-11 place-items-center text-ink hover:bg-surface-2" onClick={() => mapRef.current?.zoomOut()}>
                <Minus size={20} />
              </button>
            </div>
          </div>

          {/* Contador + sin ubicación */}
          {!selected && (
            <div className="absolute inset-x-3 bottom-[calc(84px+var(--safe-b))] z-[500] flex flex-wrap items-center gap-2 lg:bottom-[calc(96px)] lg:left-3 lg:right-auto lg:w-[420px]">
              <span className="rounded-full bg-surface/95 px-3 py-1.5 text-xs font-bold text-ink shadow-card">
                {filtered.length} en el mapa, <span className="text-crit-ink">{filtered.filter((i) => app.assessments.get(i.id)?.display === 'critica').length} críticos</span>
              </span>
              {withoutLocation.length > 0 && (
                <button onClick={() => setNoLoc(true)} className="inline-flex items-center gap-1 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-bold text-verify-ink shadow-card">
                  <MapPinOff size={13} /> {withoutLocation.length} sin ubicación
                </button>
              )}
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1.5 text-[10px] font-bold text-warn-ink shadow-card">
                Escenario ficticio
              </span>
            </div>
          )}

          {selected && <SelectedCard inc={selected} />}
        </>
      )}


      {showFilters && <FiltersSheet filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} count={filtered.length} />}
      {showLayers && <LayersSheet map={mapRef.current} onClose={() => setShowLayers(false)} />}
      {noLoc && (
        <Sheet title="Reportes sin ubicación precisa" subtitle="No se pueden ubicar en el mapa; requieren confirmación de lugar." onClose={() => setNoLoc(false)}>
          <div className="space-y-2">
            {withoutLocation.map((i) => (
              <IncidentRow key={i.id} inc={i} onClick={() => { setNoLoc(false); app.setSheet({ kind: 'detail', id: i.id }); }} />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function MapBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cx('grid h-11 w-11 place-items-center rounded-2xl shadow-card transition', active ? 'bg-brand text-on-brand' : 'bg-surface text-ink hover:bg-surface-2')}>
      {children}
    </button>
  );
}

export function IncidentRow({ inc, onClick }: { inc: Incident; onClick: () => void }) {
  const app = useApp();
  const a = app.assessments.get(inc.id);
  const dups = app.duplicatesOf.get(inc.id)?.length ?? 0;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:bg-surface-2">
      <CatIcon id={inc.category} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {a && <LevelBadge level={a.display} size="sm" />}
          {dups > 0 && <span className="text-[10px] font-bold text-ink-3">+{dups} relacionados</span>}
        </div>
        <div className="mt-0.5 truncate text-sm font-bold text-ink">{inc.title}</div>
        <div className="truncate text-xs text-ink-3">
          {inc.municipality}, {timeAgo(inc.createdAt)}
        </div>
      </div>
      <ChevronRight size={18} className="text-ink-3" />
    </button>
  );
}

function SelectedCard({ inc }: { inc: Incident }) {
  const app = useApp();
  const a = app.assessments.get(inc.id)!;
  const dups = app.duplicatesOf.get(inc.id)?.length ?? 0;
  const dir = inc.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${inc.lat},${inc.lng}` : null;
  return (
    <div className="sheet-enter absolute inset-x-3 bottom-[calc(84px+var(--safe-b))] z-[600] rounded-3xl bg-surface p-4 shadow-float lg:bottom-[96px] lg:left-3 lg:right-auto lg:w-[420px]">
      <div className="flex items-start gap-3">
        <CatIcon id={inc.category} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={a.display} size="sm" />
            <VerifBadge v={inc.verification} />
            {inc.isDemo && <SimTag>DEMO</SimTag>}
          </div>
          <div className="mt-1 text-base font-bold leading-snug text-ink">{inc.title}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
            <MapPin size={12} /> <span className="truncate">{inc.locationLabel}, {inc.municipality}</span>
          </div>
        </div>
        <button onClick={() => app.select(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
        <span className="font-bold text-ink">Por qué: </span>
        {a.reasons.slice(0, 2).map((r) => r.replace(/^[+-]?\d+ · /, '')).join('; ')}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-3">
        <span>
          <span className="font-data tnum">{inc.id}</span>, reportado {timeAgo(inc.createdAt)}
        </span>
        {dups > 0 && <span className="font-bold text-ink">{dups + 1} reportes agrupados</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <Btn className="flex-1" onClick={() => app.setSheet({ kind: 'detail', id: inc.id })}>
          Ver detalle <ChevronRight size={16} />
        </Btn>
        {dir && app.online && (
          <Btn variant="secondary" href={dir} className="px-3" onClick={() => {}}>
            <Navigation size={16} /> Ruta
          </Btn>
        )}
      </div>
    </div>
  );
}

function SearchBox({ onPickIncident }: { onPickIncident: (id: string) => void }) {
  const app = useApp();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [osm, setOsm] = useState<GeoResult[]>([]);
  const [osmState, setOsmState] = useState<'idle' | 'loading' | 'error'>('idle');
  const ctrl = useRef<AbortController | null>(null);

  const incHits = useMemo(() => {
    const n = normalize(q.trim());
    if (n.length < 2) return [];
    return app.incidents
      .filter((i) => !i.duplicateOf && [i.id, i.title, i.municipality, i.locationLabel, CAT[i.category].label].some((s) => normalize(s).includes(n)))
      .slice(0, 5);
  }, [q, app.incidents]);
  const localHits = useMemo(() => searchLocal(q), [q]);

  useEffect(() => {
    setOsm([]);
    if (!app.online || q.trim().length < 3) return;
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setOsmState('loading');
      try {
        const r = await searchNominatim(q.trim(), ctrl.current.signal);
        setOsm(r.filter((x) => !localHits.some((l) => Math.abs(l.lat - x.lat) < 0.005 && Math.abs(l.lng - x.lng) < 0.005)));
        setOsmState('idle');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setOsmState('error');
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, app.online]);

  const goPlace = (r: GeoResult) => {
    app.flyTo(r.lat, r.lng, r.source === 'osm' ? 16 : 14);
    setFocus(false);
    setQ(r.name);
  };
  const open = focus && q.trim().length >= 2;

  return (
    <div className="relative">
      <div className="flex h-12 items-center gap-2 rounded-2xl bg-surface px-3 shadow-card">
        <Search size={18} className="text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const first = localHits[0] ?? osm[0];
              if (incHits[0]) onPickIncident(incHits[0].id);
              else if (first) goPlace(first);
            }
          }}
          placeholder="Buscar lugar, dirección o incidente…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-3"
          aria-label="Buscar"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Limpiar" className="text-ink-3">
            <X size={16} />
          </button>
        )}
      </div>
      {open && (
        <div className="fade-in absolute inset-x-0 top-14 max-h-[55vh] overflow-y-auto rounded-2xl bg-surface p-2 shadow-float">
          {incHits.length > 0 && <div className="px-2 pb-1 pt-1 text-[10px] font-bold text-ink-3">Incidentes</div>}
          {incHits.map((i) => (
            <button key={i.id} onMouseDown={() => onPickIncident(i.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
              <CatIcon id={i.category} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{i.title}</div>
                <div className="truncate text-xs text-ink-3">{i.id}, {i.municipality}</div>
              </div>
            </button>
          ))}
          {localHits.length > 0 && <div className="px-2 pb-1 pt-2 text-[10px] font-bold text-ink-3">Lugares (disponible sin internet)</div>}
          {localHits.map((r) => (
            <PlaceRow key={r.name} r={r} onPick={() => goPlace(r)} />
          ))}
          {app.online && (
            <>
              <div className="flex items-center gap-2 px-2 pb-1 pt-2 text-[10px] font-bold text-ink-3">
                OpenStreetMap {osmState === 'loading' && <Loader2 size={11} className="animate-spin" />}
              </div>
              {osm.map((r, k) => (
                <PlaceRow key={k} r={r} onPick={() => goPlace(r)} />
              ))}
              {osmState === 'error' && <div className="px-2 py-1 text-xs text-ink-3">No fue posible consultar OpenStreetMap.</div>}
              {osmState === 'idle' && osm.length === 0 && q.trim().length >= 3 && <div className="px-2 py-1 text-xs text-ink-3">Sin resultados adicionales.</div>}
            </>
          )}
          {!app.online && <div className="px-2 py-2 text-xs text-ink-3">Sin internet: la búsqueda usa el nomenclátor local del Chocó.</div>}
        </div>
      )}
    </div>
  );
}

function PlaceRow({ r, onPick }: { r: GeoResult; onPick: () => void }) {
  return (
    <button onMouseDown={onPick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-ink">
        <MapPin size={16} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{r.name}</div>
        <div className="truncate text-xs text-ink-3">{r.detail}</div>
      </div>
    </button>
  );
}

function FiltersSheet({ filters, setFilters, onClose, count }: { filters: MapFilters; setFilters: (f: MapFilters) => void; onClose: () => void; count: number }) {
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <Sheet title="Filtros del mapa" subtitle={`${count} incidentes coinciden`} onClose={onClose}>
      <div className="mb-2 text-xs font-bold text-ink-3">Tipo de incidente</div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => {
          const on = filters.cats.includes(c.id);
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setFilters({ ...filters, cats: toggle(filters.cats, c.id) })}
              className={cx('flex flex-col items-center gap-1 rounded-2xl border p-2 text-center text-[11px] font-bold', on ? 'border-brand bg-brand-soft' : 'border-line')}
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: c.color }}>
                <Icon size={16} />
              </span>
              {c.short}
            </button>
          );
        })}
      </div>
      <div className="mb-2 text-xs font-bold text-ink-3">Nivel de prioridad</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {(['critica', 'alta', 'moderada', 'pendiente_verificacion', 'baja', 'atendido'] as DisplayLevel[]).map((l) => (
          <Chip key={l} active={filters.levels.includes(l)} onClick={() => setFilters({ ...filters, levels: toggle(filters.levels, l) })} color={LEVEL_META[l].color}>
            {LEVEL_META[l].label}
          </Chip>
        ))}
      </div>
      <div className="mb-2 text-xs font-bold text-ink-3">Estado de atención</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {(['activos', 'resueltos', 'todos'] as const).map((s) => (
          <Chip key={s} active={filters.status === s} onClick={() => setFilters({ ...filters, status: s })}>
            {{ activos: 'Activos', resueltos: 'Atendidos', todos: 'Todos' }[s]}
          </Chip>
        ))}
      </div>
      <div className="mb-2 text-xs font-bold text-ink-3">Verificación</div>
      <div className="mb-6 flex flex-wrap gap-2">
        {(['todos', 'verificados', 'sin_verificar'] as const).map((s) => (
          <Chip key={s} active={filters.verif === s} onClick={() => setFilters({ ...filters, verif: s })}>
            {{ todos: 'Todos', verificados: 'Verificados oficialmente', sin_verificar: 'No verificados' }[s]}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Btn variant="secondary" className="flex-1" onClick={() => setFilters(initialFilters)}>
          Limpiar
        </Btn>
        <Btn className="flex-1" onClick={onClose}>
          Ver {count} en el mapa
        </Btn>
      </div>
    </Sheet>
  );
}

function LayersSheet({ map, onClose }: { map: L.Map | null; onClose: () => void }) {
  const app = useApp();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [cached, setCached] = useState<number | null>(null);
  useEffect(() => {
    cachedTileCount().then(setCached);
  }, [progress]);
  const icons = { calles: MapIcon, satelite: Satellite, topo: Mountain, local: WifiOff, oscuro: Moon };
  const def = BASE_LAYERS.find((b) => b.id === app.settings.opsBaseLayer)!;

  const download = async () => {
    if (!map || !def.url) return;
    setProgress({ done: 0, total: 1 });
    const r = await saveAreaOffline(def, map.getBounds(), map.getZoom(), (done, total) => setProgress({ done, total }));
    setProgress(null);
    app.toast(`${r.saved} teselas de "${def.label}" disponibles sin internet`, 'ok');
  };

  return (
    <Sheet title="Capas del mapa" subtitle="Cartografía real en línea + respaldo local sin internet" onClose={onClose}>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {BASE_LAYERS.map((b) => {
          const Icon = icons[b.id];
          const on = app.settings.opsBaseLayer === b.id;
          return (
            <button
              key={b.id}
              onClick={() => app.saveSettings({ opsBaseLayer: b.id })}
              className={cx('flex items-center gap-3 rounded-2xl border p-3 text-left', on ? 'border-brand bg-brand-soft ring-2 ring-brand' : 'border-line')}
            >
              <span className={cx('grid h-10 w-10 place-items-center rounded-xl', on ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink')}>
                <Icon size={20} />
              </span>
              <div>
                <div className="text-sm font-bold">{b.label}</div>
                <div className="text-[11px] text-ink-3">{b.id === 'local' ? 'Siempre disponible' : b.id === 'satelite' ? 'Esri World Imagery' : b.id === 'topo' ? 'Esri' : 'OpenStreetMap'}</div>
              </div>
              {on && <Check size={18} className="ml-auto text-ink" />}
            </button>
          );
        })}
      </div>

      <div className="mb-5 rounded-2xl border border-line p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-crit-soft text-crit-ink">
            <Activity size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              Sismos recientes <RealTag>Dato real</RealTag>
            </div>
            <div className="text-[11px] text-ink-3">
              M2.5+ en los últimos 30 días.{' '}
              {app.usgs.status === 'loading' ? 'Cargando…' : app.usgs.at ? `${app.usgs.items.length} eventos, actualizado ${timeAgo(app.usgs.at)}` : app.online ? '' : 'Requiere internet'}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={app.settings.showUsgs}
            onClick={() => {
              app.saveSettings({ showUsgs: !app.settings.showUsgs });
              if (!app.settings.showUsgs && app.usgs.items.length === 0) app.loadUsgs();
            }}
            className={cx('relative h-7 w-12 rounded-full transition', app.settings.showUsgs ? 'bg-brand' : 'bg-line')}
          >
            <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-surface transition', app.settings.showUsgs ? 'left-6' : 'left-1')} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-brand-soft p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <Download size={16} /> Guardar esta zona para usar sin internet
        </div>
        <p className="mt-1 text-xs text-ink-2">
          Descarga las teselas de «{def.label}» del área visible (zoom actual y 2 niveles más, máx. 450 teselas). Las zonas que recorras también se guardan automáticamente.
          {cached != null && <> Teselas guardadas: <b>{cached}</b>.</>}
        </p>
        {progress ? (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full bg-brand transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-ink-3">
              {progress.done} / {progress.total}
            </div>
          </div>
        ) : (
          <Btn className="mt-3 w-full" onClick={download} disabled={!def.url || !app.online}>
            {!def.url ? 'La capa local ya está en el dispositivo' : !app.online ? 'Requiere conexión' : 'Guardar zona visible'}
          </Btn>
        )}
        <p className="mt-2 text-[11px] text-ink-3">
          Sin internet, el mapa muestra las teselas guardadas y, debajo, la cartografía vectorial local (límites, ríos, vías y cabeceras) para que nunca quede en blanco.
        </p>
      </div>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Wifi, WifiOff, Loader2, UserRound, Layers, LocateFixed, Building2, ExternalLink, Activity, CloudRain, Mountain, Waves, CloudLightning, MapPinOff } from 'lucide-react';
import { useApp } from '../store';
import { MapView } from '../components/MapView';
import { CaseRow } from './ReportsScreen';
import { LogoBadge } from '../components/Logo';
import { CAT } from '../data/categories';
import { UNITS, UNIT } from '../data/units';
import { SCENARIO } from '../data/seed';
import { LEVEL_META, LEVEL_ORDER, type DisplayLevel } from '../lib/priority';
import { cx, LevelBadge, VerifBadge, AttnBadge, CatIcon, timeAgo, fmtTime, Btn, SimTag, RestrictedTag, Chip } from '../components/ui';
import type { Attention, Incident } from '../types';
import type { BaseLayerDef } from '../services/geo';

/**
 * Tablero de la central de coordinación. Pensado para pantalla grande:
 * cola de prioridades a la izquierda, mapa operativo al centro, ficha y unidades a la derecha,
 * y abajo la evolución de la emergencia.
 */
export function CentralDashboard() {
  const app = useApp();
  const [levels, setLevels] = useState<DisplayLevel[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const primaries = useMemo(() => app.incidents.filter((i) => !i.duplicateOf && i.verification !== 'descartado'), [app.incidents]);
  const active = primaries.filter((i) => i.attention !== 'resuelto');
  const lvl = (i: Incident) => app.assessments.get(i.id)!.display;
  const queue = useMemo(
    () =>
      active
        .filter((i) => !levels.length || levels.includes(lvl(i)))
        .sort((a, b) => LEVEL_ORDER.indexOf(lvl(a)) - LEVEL_ORDER.indexOf(lvl(b)) || app.assessments.get(b.id)!.urgencyScore - app.assessments.get(a.id)!.urgencyScore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, levels, app.assessments],
  );
  const busyUnits = new Map<string, Incident>();
  for (const i of active) if (i.assignedTo) busyUnits.set(i.assignedTo, i);

  const kpis = [
    { k: 'Casos activos', v: active.length },
    { k: 'Críticos', v: active.filter((i) => lvl(i) === 'critica').length, tone: 'crit' },
    { k: 'Críticos sin unidad', v: active.filter((i) => lvl(i) === 'critica' && !i.assignedTo).length, tone: 'crit' },
    { k: 'Por verificar', v: active.filter((i) => lvl(i) === 'pendiente_verificacion').length, tone: 'verify' },
    { k: 'Personas afectadas (estimado)', v: active.reduce((s, i) => s + (i.affected ?? 0), 0).toLocaleString('es-CO') },
    { k: 'Unidades disponibles', v: `${UNITS.length - busyUnits.size} de ${UNITS.length}` },
    { k: 'Sin ubicación', v: active.filter((i) => i.lat == null).length, tone: 'verify' },
    { k: 'Atendidos', v: primaries.filter((i) => i.attention === 'resuelto').length, tone: 'ok' },
  ];

  const selected = app.selectedId ? app.incidents.find((i) => i.id === app.selectedId) : null;
  const pending = app.ops.filter((o) => o.status !== 'sincronizado').length;
  const demo = app.incidents.filter((i) => i.isDemo);
  const scenarioStart = demo.length ? Math.min(...demo.map((i) => i.createdAt)) - 3 * 60_000 : now;
  const elapsed = Math.max(0, Math.round((now - scenarioStart) / 60_000));

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper text-ink [--map-bottom:0px]">
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <LogoBadge dark />
        <div className="leading-tight">
          <div className="font-display text-xl font-bold">Central de coordinación</div>
          <div className="text-xs text-ink-3">NexoRescate, acceso de demostración</div>
        </div>
        <div className="ml-4 hidden items-center gap-2 rounded-xl bg-warn-soft px-3 py-1.5 text-sm text-warn-ink md:flex">
          <SimTag className="bg-transparent px-0">Simulacro</SimTag>
          Sismo hipotético M{SCENARIO.magnitude}, Alto Baudó. Hace {Math.floor(elapsed / 60)} h {elapsed % 60} min
        </div>
        <div className="flex-1" />
        <div className="font-display text-2xl font-semibold tnum">{fmtTime(now)}</div>
        <button
          onClick={() => app.setSheet({ kind: 'offline' })}
          className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold', app.online ? 'bg-ok-soft text-ok-ink' : 'bg-act text-on-act')}
        >
          {app.syncing ? <Loader2 size={15} className="animate-spin" /> : app.online ? <Wifi size={15} /> : <WifiOff size={15} />}
          {app.online ? 'En línea' : 'Sin internet'}
          {pending > 0 && <span className="font-data tnum">, {pending} en cola</span>}
        </button>
        <button onClick={() => app.setSheet({ kind: 'settings' })} className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-2" aria-label="Cuenta">
          <UserRound size={18} />
        </button>
      </header>

      {/* Indicadores */}
      <div className="grid shrink-0 grid-cols-4 border-b border-line bg-surface xl:grid-cols-8">
        {kpis.map((x) => (
          <div key={x.k} className="border-r border-line px-4 py-2.5 last:border-r-0">
            <div
              className={cx(
                'font-display text-[32px] font-bold leading-none tnum',
                x.tone === 'crit' ? 'text-crit' : x.tone === 'verify' ? 'text-verify' : x.tone === 'ok' ? 'text-ok' : 'text-ink',
              )}
            >
              {x.v}
            </div>
            <div className="mt-1 text-xs text-ink-3">{x.k}</div>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Cola */}
        <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-b border-line lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
          <div className="px-4 pb-2 pt-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold">Cola de prioridades</h2>
              <span className="text-sm text-ink-3">{queue.length} casos</span>
            </div>
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              {(['critica', 'alta', 'pendiente_verificacion', 'moderada'] as DisplayLevel[]).map((l) => (
                <Chip key={l} active={levels.includes(l)} color={LEVEL_META[l].color} onClick={() => setLevels(levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l])}>
                  {LEVEL_META[l].label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {queue.map((i) => (
              <div key={i.id} onClickCapture={(e) => { e.stopPropagation(); app.select(i.id, true); }}>
                <CaseRow inc={i} compact />
              </div>
            ))}
          </div>
        </aside>

        {/* Mapa + evolución */}
        <section className="flex min-h-[420px] min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MapView incidents={active} variant="ops" baseLayer={app.settings.opsBaseLayer} showUnits />
            <MapLegend />
            <LayerSwitch />
          </div>
          <Evolution incidents={primaries} now={now} />
        </section>

        {/* Ficha / unidades */}
        <aside className="w-full shrink-0 overflow-y-auto border-t border-line bg-surface lg:w-[380px] lg:border-l lg:border-t-0">
          {selected ? <CasePanel inc={selected} /> : <UnitsPanel busy={busyUnits} />}
        </aside>
      </div>
    </div>
  );
}

function MapLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-[500] rounded-2xl bg-surface p-3 text-xs shadow-card">
      <div className="mb-1.5 font-semibold text-ink-2">Prioridad</div>
      <ul className="space-y-1">
        {(['critica', 'alta', 'pendiente_verificacion', 'moderada', 'baja'] as DisplayLevel[]).map((l) => (
          <li key={l} className="flex items-center gap-2">
            <span className="grid h-4 min-w-4 place-items-center rounded-md px-1 font-data text-[10px] font-bold" style={{ background: LEVEL_META[l].color, color: ['moderada', 'alta', 'atendido'].includes(l) ? '#241034' : '#fff' }}>
              {LEVEL_META[l].glyph}
            </span>
            {LEVEL_META[l].label}
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1">
          <span className="grid h-4 w-4 place-items-center rounded bg-brand font-data text-[8px] font-bold text-on-brand">B2</span> Unidad de respuesta
        </li>
      </ul>
    </div>
  );
}

function LayerSwitch() {
  const app = useApp();
  const opts: [BaseLayerDef['id'], string][] = [
    ['oscuro', 'Noche'],
    ['calles', 'Calles'],
    ['satelite', 'Satélite'],
    ['topo', 'Relieve'],
    ['local', 'Offline'],
  ];
  return (
    <div className="absolute right-3 top-3 z-[500] flex items-center gap-1 rounded-2xl bg-surface p-1 shadow-card">
      <Layers size={16} className="mx-1.5 text-ink-3" />
      {opts.map(([id, l]) => (
        <button
          key={id}
          onClick={() => app.saveSettings({ opsBaseLayer: id })}
          className={cx('h-8 rounded-xl px-2.5 text-sm font-semibold', app.settings.opsBaseLayer === id ? 'bg-brand text-on-brand' : 'text-ink-2 hover:bg-surface-2')}
        >
          {l}
        </button>
      ))}
      <button
        onClick={async () => {
          const p = await app.locate();
          if (p) app.flyTo(p.lat, p.lng, 14);
        }}
        className="grid h-8 w-8 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
        aria-label="Mi ubicación"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}

/** Gráficas de evolución: una sola serie por gráfica, color por función, valores en texto. */
function Evolution({ incidents, now }: { incidents: Incident[]; now: number }) {
  const app = useApp();
  const all = app.incidents;
  const BIN = 30 * 60_000;
  const bins = 8;
  const start = now - bins * BIN;
  const series = Array.from({ length: bins }, (_, k) => {
    const a = start + k * BIN;
    return { from: a, to: a + BIN, n: all.filter((i) => i.createdAt >= a && i.createdAt < a + BIN).length };
  });
  const maxN = Math.max(1, ...series.map((s) => s.n));
  const [hover, setHover] = useState<number | null>(null);

  const active = incidents.filter((i) => i.attention !== 'resuelto');
  const byCat = Object.entries(
    active.reduce<Record<string, number>>((m, i) => ((m[i.category] = (m[i.category] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1]);
  const byMun = Object.entries(active.reduce<Record<string, number>>((m, i) => ((m[i.municipality] = (m[i.municipality] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const channels = [
    ['Internet', all.filter((i) => i.transmission === 'recibido_central' && (i.channel ?? 'internet') === 'internet').length],
    ['SMS', all.filter((i) => i.channel === 'sms').length],
    ['LoRa', all.filter((i) => i.channel === 'lora').length],
    ['Sin enviar', all.filter((i) => i.transmission === 'local' || i.transmission === 'pendiente').length],
  ] as [string, number][];
  const maxCat = Math.max(1, ...byCat.map((x) => x[1]));
  const maxMun = Math.max(1, ...byMun.map((x) => x[1]));
  const maxCh = Math.max(1, ...channels.map((x) => x[1]));

  return (
    <div className="grid shrink-0 grid-cols-1 gap-px border-t border-line bg-line md:grid-cols-2 xl:grid-cols-4">
      <Panel title="Reportes recibidos" note={hover != null ? `${fmtTime(series[hover].from)} a ${fmtTime(series[hover].to)}: ${series[hover].n} reportes` : 'Cada barra es media hora'}>
        <div className="flex h-[150px] items-end gap-1.5" onMouseLeave={() => setHover(null)}>
          {series.map((s, k) => (
            <button
              key={k}
              className="group flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(k)}
              onFocus={() => setHover(k)}
              aria-label={`${fmtTime(s.from)} a ${fmtTime(s.to)}: ${s.n} reportes`}
            >
              <span className="mb-1 text-center font-data text-xs tnum text-ink-2">{s.n === maxN || hover === k ? s.n : ''}</span>
              <span className={cx('block rounded-t-[4px]', hover === k ? 'bg-ink' : 'bg-brand')} style={{ height: `${Math.max(2, (s.n / maxN) * 120)}px` }} />
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-data text-xs tnum text-ink-3">
          <span>{fmtTime(series[0].from)}</span>
          <span>ahora</span>
        </div>
      </Panel>
      <Panel title="Casos activos por tipo">
        <HBars rows={byCat.slice(0, 6).map(([c, n]) => [CAT[c as Incident['category']].short, n])} max={maxCat} />
      </Panel>
      <Panel title="Municipios con más casos activos">
        <HBars rows={byMun} max={maxMun} />
      </Panel>
      <Panel title="Canal de llegada de los reportes">
        <HBars rows={channels} max={maxCh} />
      </Panel>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {note && <span className="truncate text-xs text-ink-3">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function HBars({ rows, max }: { rows: [string, number][]; max: number }) {
  return (
    <ul className="space-y-1.5">
      {rows.slice(0, 5).map(([k, n]) => (
        <li key={k} title={`${k}: ${n}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm leading-tight">
            <span className="truncate text-ink-2">{k}</span>
            <span className="font-data tnum">{n}</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full">
            <div className="h-full rounded-r-[4px] bg-brand" style={{ width: `${n === 0 ? 0 : Math.max(3, (n / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function UnitsPanel({ busy }: { busy: Map<string, Incident> }) {
  const app = useApp();
  const icons = { sismo: Activity, lluvia: CloudRain, deslizamiento: Mountain, tsunami: Waves, meteo: CloudLightning };
  return (
    <div className="p-4">
      <h2 className="text-base font-bold">Unidades</h2>
      <p className="text-sm text-ink-3">Selecciona un caso en el mapa o la cola para asignar.</p>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {UNITS.map((u) => {
          const c = busy.get(u.id);
          return (
            <li key={u.id}>
              <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2" onClick={() => (c ? app.select(c.id, true) : app.flyTo(u.lat, u.lng, 14))}>
                <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl font-data text-sm font-bold', c ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-2')}>{u.short}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.name}</div>
                  <div className="truncate text-xs text-ink-3">{c ? `En ${c.id}: ${c.title}` : `Disponible en ${u.base}, ${u.members} integrantes`}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-3">Unidades y posiciones simuladas.</p>

      <h2 className="mt-6 text-base font-bold">Alertas oficiales</h2>
      <ul className="mt-2 space-y-2">
        {app.alerts.slice(0, 5).map((a) => {
          const I = icons[a.kind];
          return (
            <li key={a.id} className="flex gap-3 rounded-2xl border border-line p-3">
              <I size={18} className={cx('mt-0.5 shrink-0', a.level === 'roja' ? 'text-crit' : a.level === 'naranja' ? 'text-high' : a.level === 'amarilla' ? 'text-mod' : 'text-info')} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs text-ink-3">
                  {a.sourceShort}, actualizada {timeAgo(a.updatedAt)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {app.usgs.items.length > 0 && (
        <p className="mt-2 text-xs text-ink-3">
          Hay {app.usgs.items.length} sismos reales del USGS en la región (últimos 30 días). Actívalos desde la vista de rescatista.
        </p>
      )}
    </div>
  );
}

function CasePanel({ inc }: { inc: Incident }) {
  const app = useApp();
  const a = app.assessments.get(inc.id)!;
  const dups = app.duplicatesOf.get(inc.id)?.length ?? 0;
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <CatIcon id={inc.category} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold leading-snug">{inc.title}</div>
          <div className="text-sm text-ink-3">
            <span className="font-data tnum">{inc.id}</span>, {inc.municipality}, {timeAgo(inc.createdAt)}
          </div>
        </div>
        <button onClick={() => app.select(null)} className="rounded-xl px-2 py-1 text-sm font-semibold text-ink-3 hover:bg-surface-2">
          Cerrar
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <LevelBadge level={a.display} size="sm" />
        <VerifBadge v={inc.verification} />
        <AttnBadge a={inc.attention} />
        {dups > 0 && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold leading-5">{dups + 1} reportes agrupados</span>}
      </div>

      <p className="mt-3 text-[15px] leading-relaxed">{inc.description}</p>
      {inc.lat == null && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-verify-ink">
          <MapPinOff size={14} /> Sin coordenadas: confirmar el lugar
        </p>
      )}

      {inc.restrictedNotes && (
        <div className="mt-3 rounded-2xl bg-verify-soft p-3 text-sm text-verify-ink">
          <RestrictedTag />
          <p className="mt-1">{inc.restrictedNotes}</p>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-surface-2 p-3">
        <div className="text-sm font-semibold text-ink-2">Por qué</div>
        <ul className="mt-1 space-y-0.5 text-sm">
          {a.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r.split(' · ').slice(1).join(' · ')}</li>
          ))}
        </ul>
        <div className="mt-1 text-xs text-ink-3">
          Urgencia {a.urgencyScore}/100, confianza {a.confidenceScore}/100
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-2">Unidad asignada</span>
        <select value={inc.assignedTo ?? ''} onChange={(e) => app.assignUnit(inc.id, e.target.value || null)} className="h-11 w-full rounded-xl border border-line bg-surface px-3">
          <option value="">Sin asignar</option>
          {UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      {inc.assignedTo && <p className="mt-1 text-xs text-ink-3">{UNIT[inc.assignedTo].org}</p>}

      <div className="mt-4 text-sm font-semibold text-ink-2">Atención</div>
      <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
        {(['pendiente', 'asignado', 'en_atencion', 'resuelto'] as Attention[]).map((s) => (
          <button
            key={s}
            onClick={() => app.setAttention(inc.id, s, 'equipo')}
            className={cx('min-h-[36px] rounded-lg text-xs font-semibold', inc.attention === s ? (s === 'resuelto' ? 'bg-ok text-on-ok' : 'bg-brand text-on-brand') : 'text-ink-2')}
          >
            {{ pendiente: 'Pendiente', asignado: 'Asignado', en_atencion: 'En sitio', resuelto: 'Resuelto' }[s]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn size="sm" variant={inc.verification === 'verificado_oficial' ? 'ok' : 'outline'} onClick={() => app.verify(inc.id, 'verificado_oficial')}>
          Verificar
        </Btn>
        <Btn size="sm" variant="outline" onClick={() => app.verify(inc.id, 'descartado')}>
          Descartar
        </Btn>
      </div>
      <Btn className="mt-3 w-full" variant="secondary" size="sm" onClick={() => app.setSheet({ kind: 'detail', id: inc.id })}>
        <ExternalLink size={15} /> Ficha completa y bitácora
      </Btn>
      <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
        <Building2 size={13} /> Fuente: {inc.sourceLabel}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Activity, CloudRain, Mountain, Waves, CloudLightning, RefreshCw, ExternalLink, Loader2, MapPin, Plug } from 'lucide-react';
import { useApp } from '../store';
import { PENDING_SOURCES } from '../services/alerts';
import { cx, fmtDate, timeAgo, SimTag, RealTag, Chip } from '../components/ui';
import type { OfficialAlert } from '../types';

const KIND = {
  sismo: { icon: Activity, label: 'Actividad sísmica' },
  lluvia: { icon: CloudRain, label: 'Lluvias e inundaciones' },
  deslizamiento: { icon: Mountain, label: 'Deslizamientos' },
  tsunami: { icon: Waves, label: 'Tsunami' },
  meteo: { icon: CloudLightning, label: 'Meteorológicas' },
};
const LEVEL = {
  roja: 'bg-crit text-white',
  naranja: 'bg-act text-on-act',
  amarilla: 'bg-mod text-[#241034]',
  informativa: 'bg-info-soft text-info-ink',
};

export function AlertsScreen() {
  const app = useApp();
  const [kind, setKind] = useState<OfficialAlert['kind'] | 'todas'>('todas');
  const demo = app.alerts.filter((a) => kind === 'todas' || a.kind === kind);
  const real = kind === 'todas' || kind === 'sismo' ? app.usgs.items.slice(0, 12) : [];

  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-2">
      <h1 className="text-xl font-bold text-ink">Alertas oficiales</h1>
      <p className="text-xs text-ink-3">Cada alerta indica su fuente y si es un dato real o simulado.</p>

      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={kind === 'todas'} onClick={() => setKind('todas')}>
          Todas
        </Chip>
        {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND[k].label}
          </Chip>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-mod/50 bg-warn-soft p-3 text-xs text-warn-ink">
        <b>Escenario de demostración.</b> Las alertas marcadas como SIMULADO no provienen del SGC, IDEAM, DIMAR ni UNGRD: son datos ficticios para el ejercicio en el Chocó.
      </div>

      <div className="mt-4 space-y-3">
        {demo.map((a) => (
          <AlertCard key={a.id} a={a} />
        ))}
      </div>

      {(kind === 'todas' || kind === 'sismo') && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              Sismos recientes en la región <RealTag>REAL · USGS</RealTag>
            </h2>
            <button onClick={app.loadUsgs} disabled={!app.online || app.usgs.status === 'loading'} className="inline-flex items-center gap-1 text-xs font-bold text-brand disabled:opacity-40">
              {app.usgs.status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualizar
            </button>
          </div>
          <p className="mb-3 text-[11px] text-ink-3">
            Feed público del Servicio Geológico de EE. UU. (M2.5+, 30 días, Colombia y alrededores).{' '}
            {app.usgs.at ? `Consultado ${timeAgo(app.usgs.at)}.` : ''}
            {app.usgs.status === 'error' && ' No fue posible actualizar; se muestra la última copia guardada.'}
            {!app.online && ' Sin internet: se muestra la última copia guardada.'}
          </p>
          {real.length === 0 && <div className="rounded-2xl bg-surface-2 p-4 text-center text-xs text-ink-3">{app.online ? 'Sin datos aún. Toca «Actualizar».' : 'Disponible al recuperar conexión.'}</div>}
          <div className="space-y-2">
            {real.map((a) => (
              <AlertCard key={a.id} a={a} compact />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          <Plug size={15} /> Integraciones oficiales previstas
        </h2>
        <div className="space-y-2">
          {PENDING_SOURCES.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-2xl border border-dashed border-line p-3">
              <div>
                <div className="text-sm font-bold text-ink">{s.name}</div>
                <div className="text-[11px] text-ink-3">{s.scope}</div>
              </div>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-ink-2">{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ a, compact }: { a: OfficialAlert; compact?: boolean }) {
  const app = useApp();
  const K = KIND[a.kind];
  const Icon = K.icon;
  return (
    <div className={cx('rounded-3xl border bg-surface p-4', a.simulated ? 'border-line' : 'border-ok/40')}>
      <div className="flex items-start gap-3">
        <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', LEVEL[a.level])}>
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {a.simulated ? <SimTag /> : <RealTag />}
            <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold ', LEVEL[a.level])}>{a.level === 'informativa' ? 'Informativa' : `Alerta ${a.level}`}</span>
          </div>
          <div className="mt-1 font-bold leading-snug text-ink">{a.title}</div>
          {!compact && <p className="mt-1 text-sm text-ink-2">{a.body}</p>}
          {compact && <p className="text-xs text-ink-2">{a.body}</p>}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-3">
            <div className="col-span-2">
              <dt className="inline font-bold">Fuente: </dt>
              <dd className="inline">{a.source}</dd>
            </div>
            <div className="col-span-2">
              <dt className="inline font-bold">Ubicación: </dt>
              <dd className="inline">{a.location}</dd>
            </div>
            <div>
              <dt className="font-bold">Emitida</dt>
              <dd>{fmtDate(a.issuedAt)}</dd>
            </div>
            <div>
              <dt className="font-bold">Actualizada</dt>
              <dd>{timeAgo(a.updatedAt)}</dd>
            </div>
          </dl>
          <div className="mt-2 flex gap-3">
            {a.lat != null && (
              <button
                onClick={() => {
                  if (!a.simulated) app.saveSettings({ showUsgs: true });
                  app.setTab('mapa');
                  app.flyTo(a.lat!, a.lng!, a.simulated ? 10 : 8);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand"
              >
                <MapPin size={13} /> Ver en mapa
              </button>
            )}
            {a.url && (
              <a href={a.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                <ExternalLink size={13} /> Fuente
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

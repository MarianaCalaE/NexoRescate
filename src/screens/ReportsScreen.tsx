import { useMemo, useState } from 'react';
import { RefreshCw, History, ListChecks, Inbox, MapPinOff } from 'lucide-react';
import { useApp } from '../store';
import { CATEGORIES, TX_LABEL, VERIF_LABEL, ATTN_LABEL } from '../data/categories';
import { UNIT } from '../data/units';
import { haversineKm } from '../data/places';
import { LEVEL_META, LEVEL_ORDER, type DisplayLevel } from '../lib/priority';
import { cx, LevelBadge, TxBadge, VerifBadge, AttnBadge, CatIcon, timeAgo, fmtDate, Btn, SimTag } from '../components/ui';
import type { Incident } from '../types';

type View = 'prioridad' | 'mios' | 'cola' | 'bitacora';

/** Cola de trabajo del rescatista: ordenada por prioridad y cercanía. */
export function ReportsScreen() {
  const app = useApp();
  const myUnit = app.session.unitId;
  const [view, setView] = useState<View>('prioridad');
  const [cat, setCat] = useState('');
  const [prio, setPrio] = useState('');
  const [verif, setVerif] = useState('');
  const [attn, setAttn] = useState('');
  const [tx, setTx] = useState('');
  const [showDone, setShowDone] = useState(false);

  const dist = (i: Incident) => (app.userPos && i.lat != null ? haversineKm(app.userPos.lat, app.userPos.lng, i.lat, i.lng!) : null);

  const list = useMemo(() => {
    let l = app.incidents.filter((i) => !i.duplicateOf);
    if (view === 'mios') l = l.filter((i) => i.assignedTo === myUnit || (i.mine && !myUnit));
    if (!showDone && view === 'prioridad') l = l.filter((i) => i.attention !== 'resuelto' && i.verification !== 'descartado');
    if (cat) l = l.filter((i) => i.category === cat);
    if (prio) l = l.filter((i) => app.assessments.get(i.id)?.display === prio);
    if (verif) l = l.filter((i) => i.verification === verif);
    if (attn) l = l.filter((i) => i.attention === attn);
    if (tx) l = l.filter((i) => i.transmission === tx);
    return l.sort((a, b) => {
      const la = LEVEL_ORDER.indexOf(app.assessments.get(a.id)!.display);
      const lb = LEVEL_ORDER.indexOf(app.assessments.get(b.id)!.display);
      if (la !== lb) return la - lb;
      const da = dist(a) ?? 9999;
      const db = dist(b) ?? 9999;
      if (Math.abs(da - db) > 0.5) return da - db;
      return app.assessments.get(b.id)!.urgencyScore - app.assessments.get(a.id)!.urgencyScore;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.incidents, app.assessments, view, cat, prio, verif, attn, tx, showDone, myUnit, app.userPos]);

  const pending = app.ops.filter((o) => o.status !== 'sincronizado');
  const myCount = app.incidents.filter((i) => i.assignedTo === myUnit && i.attention !== 'resuelto').length;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-2">
        <h1 className="font-display text-3xl font-bold leading-tight">Prioridades</h1>
        <p className="text-sm text-ink-3">
          Ordenadas por prioridad y cercanía. {pending.length > 0 ? `${pending.length} cambios esperan sincronizar.` : 'Todo sincronizado.'} Última sincronización{' '}
          {app.lastSync ? timeAgo(app.lastSync) : 'nunca'}.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
          {(
            [
              ['prioridad', 'Todas'],
              ['mios', `Mis casos (${myCount})`],
              ['cola', `Envíos (${pending.length})`],
              ['bitacora', 'Bitácora'],
            ] as [View, string][]
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cx('min-h-[40px] rounded-xl text-sm font-semibold', view === k ? 'bg-surface text-ink shadow-card' : 'text-ink-3')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {(view === 'prioridad' || view === 'mios') && (
        <>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-5 pb-2">
            <Select value={prio} onChange={setPrio} label="Prioridad" options={(Object.keys(LEVEL_META) as DisplayLevel[]).map((k) => [k, LEVEL_META[k].label])} />
            <Select value={cat} onChange={setCat} label="Tipo" options={CATEGORIES.map((c) => [c.id, c.short])} />
            <Select value={attn} onChange={setAttn} label="Atención" options={Object.entries(ATTN_LABEL)} />
            <Select value={verif} onChange={setVerif} label="Verificación" options={Object.entries(VERIF_LABEL)} />
            <Select value={tx} onChange={setTx} label="Transmisión" options={Object.entries(TX_LABEL)} />
            {view === 'prioridad' && (
              <button onClick={() => setShowDone(!showDone)} className={cx('h-9 shrink-0 rounded-md border px-3 text-sm font-semibold', showDone ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2')}>
                Incluir resueltos
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-6">
            {list.length === 0 && (
              <div className="mt-12 flex flex-col items-center text-center text-ink-3">
                <Inbox size={40} className="mb-2 opacity-60" />
                {view === 'mios' ? 'Tu unidad no tiene casos asignados. Toma uno desde la lista de prioridades.' : 'No hay casos con estos filtros.'}
                {view === 'mios' && (
                  <Btn className="mt-4" variant="secondary" onClick={() => setView('prioridad')}>
                    Ver prioridades
                  </Btn>
                )}
              </div>
            )}
            {list.map((i) => (
              <CaseRow key={i.id} inc={i} km={dist(i)} />
            ))}
          </div>
        </>
      )}

      {view === 'cola' && (
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <p className="mb-3 text-sm text-ink-2">
            Cada cambio lleva un identificador único y una versión. Al reintentar, la central ignora los que ya recibió, así no se duplican.
          </p>
          {!app.online && (
            <Btn className="mb-3 w-full" variant="ok" onClick={app.simulateReconnect}>
              <RefreshCw size={18} /> Simular que volvió la conexión <SimTag className="bg-on-ok/15 text-on-ok">Demo</SimTag>
            </Btn>
          )}
          <div className="divide-y divide-line rounded-2xl border border-line">
            {app.ops.length === 0 && <div className="p-6 text-center text-ink-3">No hay envíos registrados.</div>}
            {app.ops.map((o) => (
              <div key={o.opId} className="flex items-center gap-3 p-3">
                <ListChecks size={18} className={o.status === 'sincronizado' ? 'text-ok' : o.status === 'error' ? 'text-crit' : 'text-act'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{o.summary}</div>
                  <div className="text-xs text-ink-3">
                    <span className="font-data tnum">{o.opId}</span>, versión {o.version}, {fmtDate(o.createdAt)}, {o.attempts} intento(s)
                  </div>
                </div>
                <span className={cx('rounded-md px-2 py-0.5 text-xs font-semibold', o.status === 'sincronizado' ? 'bg-ok-soft text-ok-ink' : o.status === 'error' ? 'bg-crit-soft text-crit-ink' : 'bg-high-soft text-high-ink')}>
                  {o.status === 'sincronizado' ? 'Sincronizado' : o.status === 'pendiente' ? 'Pendiente' : o.status === 'enviando' ? 'Enviando' : 'Error'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">La central de esta demostración es simulada.</p>
        </div>
      )}

      {view === 'bitacora' && (
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <ol className="divide-y divide-line rounded-2xl border border-line">
            {app.log.map((l) => (
              <li key={l.id} className="flex gap-3 p-3">
                <History size={16} className="mt-0.5 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <div className="text-sm">{l.text}</div>
                  <div className="text-xs text-ink-3">{fmtDate(l.at)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function CaseRow({ inc, km, compact }: { inc: Incident; km?: number | null; compact?: boolean }) {
  const app = useApp();
  const a = app.assessments.get(inc.id)!;
  const dups = app.duplicatesOf.get(inc.id)?.length ?? 0;
  const unit = inc.assignedTo ? UNIT[inc.assignedTo] : null;
  return (
    <button
      onClick={() => app.setSheet({ kind: 'detail', id: inc.id })}
      className={cx('relative w-full overflow-hidden rounded-2xl border border-line bg-surface p-3 pl-4 text-left hover:bg-surface-2', app.selectedId === inc.id && 'ring-2 ring-brand')}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: LEVEL_META[a.display].color }} aria-hidden />
      <div className="flex items-start gap-3">
        <CatIcon id={inc.category} size={compact ? 36 : 42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LevelBadge level={a.display} size="sm" />
            {km != null && <span className="font-data text-sm font-semibold tnum text-ink-2">{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</span>}
            {inc.lat == null && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-verify-ink">
                <MapPinOff size={12} /> Sin ubicación
              </span>
            )}
          </div>
          <div className="mt-1 truncate font-semibold">{inc.title}</div>
          <div className="truncate text-sm text-ink-3">
            {inc.municipality}, {timeAgo(inc.createdAt)}
            {dups ? `, ${dups + 1} reportes` : ''}
            {inc.affected ? `, ${inc.affected.toLocaleString('es-CO')} afectados` : ''}
          </div>
          {!compact && (
            <div className="mt-2 flex flex-wrap gap-1">
              <AttnBadge a={inc.attention} />
              <VerifBadge v={inc.verification} />
              {unit && <span className="inline-flex rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold leading-5 text-ink">{unit.short}: {unit.name.split('·')[0].trim()}</span>}
              {inc.transmission !== 'recibido_central' && <TxBadge inc={inc} />}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cx('h-9 shrink-0 rounded-md border px-3 text-sm font-semibold', value ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-2')}
    >
      <option value="">{label}</option>
      {options.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
}

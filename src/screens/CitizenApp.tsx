import { useMemo, useState } from 'react';
import type L from 'leaflet';
import { Menu, LocateFixed, Loader2, Wifi, WifiOff, ChevronRight, Inbox, BellRing, ShieldCheck, Info, Siren, CloudRain, Mountain, Waves, CloudLightning, Activity, Building2, Radio, Check, IdCard } from 'lucide-react';
import { useApp } from '../store';
import { MapView } from '../components/MapView';
import { Logo } from '../components/Logo';
import { ReportFlow } from './ReportFlow';
import { CITIZEN_LABEL } from '../data/safety';
import { UNITS } from '../data/units';
import { Sheet, Btn, cx, timeAgo, SimTag, CatIcon, fmtDate } from '../components/ui';
import type { Incident, OfficialAlert, CategoryId } from '../types';

/** Lo que el ciudadano ve en el mapa: peligros para moverse. Los casos de personas no se muestran (privacidad y evitar aglomeraciones). */
const PUBLIC_HAZARDS: CategoryId[] = ['deslizamiento', 'inundacion', 'incendio', 'estructural', 'poste', 'via', 'sismo', 'otro'];

export function CitizenApp() {
  const app = useApp();
  const [reporting, setReporting] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = { current: null as L.Map | null };

  const visible = useMemo(
    () =>
      app.incidents.filter(
        (i) =>
          (i.mine && !i.duplicateOf) ||
          (!i.duplicateOf && PUBLIC_HAZARDS.includes(i.category) && i.attention !== 'resuelto' && i.verification !== 'descartado'),
      ),
    [app.incidents],
  );
  const mine = app.incidents.filter((i) => i.mine).sort((a, b) => b.createdAt - a.createdAt);
  const latest = mine[0];
  const topAlert = useMemo(() => {
    const order = { roja: 0, naranja: 1, amarilla: 2, informativa: 3 };
    return [...app.alerts].sort((a, b) => order[a.level] - order[b.level] || b.updatedAt - a.updatedAt)[0];
  }, [app.alerts]);
  const selected = app.selectedId ? app.incidents.find((i) => i.id === app.selectedId) : null;

  const locateMe = async () => {
    setLocating(true);
    const p = await app.locate();
    setLocating(false);
    if (p) app.flyTo(p.lat, p.lng, 15);
  };

  return (
    <div className="relative h-full w-full overflow-hidden [--map-bottom:calc(178px+var(--safe-b))] lg:[--map-bottom:0px]">
      <div className="absolute inset-0">
        <MapView incidents={visible} variant="citizen" baseLayer={app.settings.baseLayer} onMap={(m) => (mapRef.current = m)} />
      </div>

      {/* Barra superior: solo marca, estado de conexión y menú */}
      <header className="absolute inset-x-0 top-0 z-[700] px-3 pt-[calc(10px+var(--safe-t))]">
        <div className="flex items-center gap-2">
          <div className="flex h-12 items-center gap-2 rounded-2xl bg-surface/95 pl-2 pr-3 shadow-card backdrop-blur">
            <Mark />
            <span className="font-display text-xl font-bold tracking-tight">NexoRescate</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => app.setSheet({ kind: 'offline' })}
            className={cx('flex h-12 items-center gap-2 rounded-2xl px-3 text-sm font-semibold shadow-card', app.online ? 'bg-surface/95 text-ok-ink' : 'bg-act text-on-act')}
          >
            {app.online ? <Wifi size={18} /> : <WifiOff size={18} />}
            {app.online ? 'Conectado' : 'Sin internet'}
          </button>
          <button onClick={() => app.setSheet({ kind: 'mine' })} className="grid h-12 w-12 place-items-center rounded-2xl bg-surface/95 text-ink shadow-card" aria-label="Menú">
            <Menu size={22} />
          </button>
        </div>
        {topAlert && (
          <button onClick={() => app.setSheet({ kind: 'alerts' })} className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-surface/95 p-3 text-left shadow-card backdrop-blur lg:max-w-[420px]">
            <AlertGlyph a={topAlert} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{topAlert.title}</div>
              <div className="truncate text-sm text-ink-3">
                {topAlert.location}. {topAlert.simulated ? 'Simulacro.' : ''}
              </div>
            </div>
            <ChevronRight size={20} className="text-ink-3" />
          </button>
        )}
        {!app.profile && (
          <button
            onClick={() => app.setSheet({ kind: 'register' })}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand/60 bg-surface/95 px-3 py-2.5 text-left shadow-card backdrop-blur lg:max-w-[420px]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <IdCard size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">Registra tu cédula</span>
              <span className="block truncate text-sm text-ink-3">Es necesaria para enviar reportes. Toma 10 segundos.</span>
            </span>
            <span className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-on-brand">Registrar</span>
          </button>
        )}
      </header>

      <button
        onClick={locateMe}
        className="absolute bottom-[calc(200px+var(--safe-b))] right-3 z-[600] lg:bottom-12 grid h-12 w-12 place-items-center rounded-2xl bg-surface text-ink shadow-card"
        aria-label="Ver mi ubicación"
      >
        {locating ? <Loader2 size={22} className="animate-spin" /> : <LocateFixed size={22} />}
      </button>

      {/* Panel inferior: una sola acción principal */}
      <section className="absolute inset-x-0 bottom-0 z-[700] rounded-t-[28px] bg-surface px-4 pb-[calc(16px+var(--safe-b))] pt-4 shadow-float lg:inset-x-auto lg:bottom-4 lg:left-4 lg:w-[420px] lg:rounded-[28px]">
        {latest ? (
          <button onClick={() => app.setSheet({ kind: 'mine' })} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-left">
            <StatusDot inc={latest} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">Tu reporte: {CITIZEN_LABEL[latest.category].toLowerCase()}</div>
              <div className="truncate text-sm text-ink-3">{citizenStatus(latest, app.online)}</div>
            </div>
            <ChevronRight size={18} className="text-ink-3" />
          </button>
        ) : (
          <p className="mb-3 px-1 text-base text-ink-2">¿Ves una emergencia o necesitas ayuda?</p>
        )}
        <button
          onClick={() => {
            app.select(null);
            setReporting(true);
          }}
          className="breathe flex min-h-[72px] w-full items-center justify-center gap-3 rounded-[22px] bg-act text-on-act shadow-float transition active:scale-[.98]"
        >
          <Siren size={28} strokeWidth={2.2} />
          <span className="font-display text-[28px] font-bold leading-none">Reportar emergencia</span>
        </button>
        <p className="mt-3 text-center text-sm text-ink-3">
          Funciona sin internet. Peligro inmediato:{' '}
          <a className="font-bold text-ink underline" href="tel:123">
            llama al 123
          </a>
        </p>
      </section>

      {selected && !reporting && <CitizenIncidentSheet inc={selected} />}
      {reporting && <ReportFlow onClose={() => setReporting(false)} />}
    </div>
  );
}

function Mark() {
  return <Logo className="h-8 w-auto" />;
}
export { Mark };

export function citizenStatus(inc: Incident, online: boolean) {
  if (inc.attention === 'resuelto') return 'Un equipo marcó la emergencia como atendida';
  if (inc.attention === 'en_atencion') return 'Un equipo está en el lugar';
  if (inc.attention === 'asignado') return 'Un equipo fue asignado';
  if (inc.transmission === 'recibido_central') return 'La central lo recibió';
  if (inc.transmission === 'enviado_canal') return `Enviado por ${inc.sentVia?.length ? inc.sentVia.map((c) => (c === 'sms' ? 'SMS' : 'radio')).join(' y ') : inc.channel === 'sms' ? 'SMS' : 'radio'}, esperando confirmación`;
  return online ? 'Enviando…' : 'Guardado en tu teléfono, se enviará con internet';
}

function StatusDot({ inc }: { inc: Incident }) {
  const done = inc.transmission === 'recibido_central' || inc.attention !== 'pendiente';
  return (
    <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full', done ? 'bg-ok-soft text-ok-ink' : 'bg-high-soft text-high-ink')}>
      {done ? <Check size={20} strokeWidth={3} /> : <WifiOff size={18} />}
    </span>
  );
}

function AlertGlyph({ a }: { a: OfficialAlert }) {
  const I = { sismo: Activity, lluvia: CloudRain, deslizamiento: Mountain, tsunami: Waves, meteo: CloudLightning }[a.kind];
  const bg = { roja: 'bg-crit text-white', naranja: 'bg-high text-on-act', amarilla: 'bg-mod text-[#241034]', informativa: 'bg-info-soft text-info-ink' }[a.level];
  return (
    <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', bg)}>
      <I size={22} />
    </span>
  );
}

/** Ficha simple para ciudadanos: qué es, dónde, y dos acciones. */
function CitizenIncidentSheet({ inc }: { inc: Incident }) {
  const app = useApp();
  const [done, setDone] = useState<null | 'activo' | 'atendido'>(null);
  const status =
    inc.attention === 'en_atencion'
      ? 'Un equipo está atendiendo'
      : inc.attention === 'asignado'
        ? 'Un equipo va en camino'
        : inc.verification === 'verificado_oficial'
          ? 'Confirmado por un equipo de respuesta'
          : 'Reportado por la comunidad, sin confirmar';
  return (
    <Sheet onClose={() => app.select(null)} title={<div className="flex items-center gap-3"><CatIcon id={inc.category} size={44} />{CITIZEN_LABEL[inc.category]}</div>}>
      <p className="text-lg">{inc.locationLabel}, {inc.municipality}</p>
      <p className="mt-1 text-base text-ink-3">Reportado {timeAgo(inc.createdAt)}. {status}.</p>
      {inc.isDemo && <SimTag className="mt-2">Dato ficticio del simulacro</SimTag>}
      {inc.mine ? (
        <p className="mt-5 rounded-2xl bg-surface-2 p-4 text-base">Este es tu reporte. {citizenStatus(inc, app.online)}.</p>
      ) : done ? (
        <p className="mt-5 rounded-2xl bg-ok-soft p-4 text-base text-ok-ink">Gracias, lo tendremos en cuenta.</p>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-base font-semibold">¿Estás cerca? Cuéntanos:</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="outline" size="lg" onClick={async () => { await app.confirmActive(inc.id); setDone('activo'); }}>
              Sigue pasando
            </Btn>
            <Btn variant="outline" size="lg" onClick={async () => { await app.setAttention(inc.id, 'resuelto', 'ciudadano'); setDone('atendido'); }}>
              Ya no está
            </Btn>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Menú secundario: todo lo que no es esencial vive aquí, fuera de la vista principal. */
export function CitizenMenu() {
  const app = useApp();
  const mine = app.incidents.filter((i) => i.mine).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <Sheet title="Tus reportes" onClose={() => app.setSheet(null)}>
      {mine.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-surface-2 px-4 py-8 text-center">
          <Inbox size={36} className="text-ink-3" />
          <p className="mt-2 text-base text-ink-2">Aún no has enviado reportes desde este teléfono.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {mine.map((i) => (
            <li key={i.id}>
              <button
                className="flex w-full items-center gap-3 p-3 text-left"
                onClick={() => {
                  app.setSheet(null);
                  if (i.lat != null) {
                    app.select(i.id, true);
                  }
                }}
              >
                <StatusDot inc={i} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{CITIZEN_LABEL[i.category]}</div>
                  <div className="text-sm text-ink-3">{citizenStatus(i, app.online)}</div>
                  <div className="text-sm text-ink-3">
                    {fmtDate(i.createdAt)}, código <span className="font-data tnum">{i.id}</span>
                  </div>
                </div>
                {(i.transmission === 'local' || i.transmission === 'pendiente') && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      app.setSheet({ kind: 'sms', id: i.id });
                    }}
                    className="rounded-xl bg-act px-3 py-2 text-sm font-bold text-on-act"
                  >
                    Enviar por SMS
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-6 divide-y divide-line rounded-2xl border border-line" aria-label="Más opciones">
        <MenuRow icon={BellRing} label="Alertas oficiales" onClick={() => app.setSheet({ kind: 'alerts' })} />
        <MenuRow icon={app.online ? Wifi : WifiOff} label="Conexión y envíos pendientes" onClick={() => app.setSheet({ kind: 'offline' })} />
        <MenuRow icon={IdCard} label={app.profile ? 'Tu registro' : 'Registrar tu cédula (pendiente)'} onClick={() => app.setSheet({ kind: 'register' })} />
        <MenuRow icon={ShieldCheck} label="Acceso para equipos de respuesta" onClick={() => app.setSheet({ kind: 'access' })} />
        <MenuRow icon={Info} label="Acerca de esta app" onClick={() => app.setSheet({ kind: 'settings' })} />
      </nav>
    </Sheet>
  );
}

function MenuRow({ icon: Icon, label, onClick }: { icon: typeof Info; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left text-base font-semibold">
      <Icon size={20} className="text-ink-3" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={18} className="text-ink-3" />
    </button>
  );
}

export function CitizenAlerts() {
  const app = useApp();
  return (
    <Sheet title="Alertas oficiales" subtitle="Simulacro: estas alertas son ficticias y no vienen de las entidades." onClose={() => app.setSheet(null)}>
      <ul className="space-y-3">
        {app.alerts.map((a) => (
          <li key={a.id} className="flex gap-3 rounded-2xl border border-line p-4">
            <AlertGlyph a={a} />
            <div className="min-w-0">
              <div className="text-base font-bold">{a.title}</div>
              <p className="mt-0.5 text-[15px] text-ink-2">{a.body}</p>
              <p className="mt-1 text-sm text-ink-3">
                {a.source}. Actualizada {timeAgo(a.updatedAt)}.
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Acceso de demostración para equipos. En producción: cuenta institucional. */
export function AccessSheet() {
  const app = useApp();
  const [unit, setUnit] = useState(UNITS[0].id);
  return (
    <Sheet title="Acceso para equipos de respuesta" subtitle="Acceso de demostración. En producción se usaría una cuenta institucional verificada." onClose={() => app.setSheet(null)}>
      <div className="rounded-3xl border border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-on-brand">
            <Radio size={22} />
          </span>
          <div>
            <div className="text-lg font-bold">Rescatista en campo</div>
            <div className="text-sm text-ink-3">Todos los reportes, datos restringidos, asignación y radio.</div>
          </div>
        </div>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-3 h-12 w-full rounded-2xl border border-line bg-surface px-3 text-base" aria-label="Unidad">
          {UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Btn className="mt-3 w-full" onClick={() => app.login('rescatista', unit)}>
          Entrar como rescatista
        </Btn>
      </div>
      <div className="mt-3 rounded-3xl border border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-paper">
            <Building2 size={22} />
          </span>
          <div>
            <div className="text-lg font-bold">Central de coordinación</div>
            <div className="text-sm text-ink-3">Tablero con la situación completa. Mejor en pantalla grande.</div>
          </div>
        </div>
        <Btn className="mt-3 w-full" variant="secondary" onClick={() => app.login('central')}>
          Entrar a la central
        </Btn>
      </div>
    </Sheet>
  );
}

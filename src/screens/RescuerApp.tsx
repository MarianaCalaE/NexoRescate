import { useState } from 'react';
import { Map as MapIcon, BellRing, Plus, ListOrdered, Radio, Wifi, WifiOff, Loader2, UserRound, MessageSquare, RefreshCw, CloudOff } from 'lucide-react';
import { useApp, type Tab } from '../store';
import { MapScreen } from './MapScreen';
import { ReportsScreen } from './ReportsScreen';
import { AlertsScreen } from './AlertsScreen';
import { ReportFlow } from './ReportFlow';
import { LogoBadge } from '../components/Logo';
import { UNIT } from '../data/units';
import { radio } from '../services/radio';
import { cx, timeAgo, Btn, SimTag } from '../components/ui';

/** App de campo para rescatistas: tema nocturno, más información, menos decoración. */
export function RescuerApp() {
  const app = useApp();
  const [reporting, setReporting] = useState(false);
  const unit = app.session.unitId ? UNIT[app.session.unitId] : null;
  const pending = app.ops.filter((o) => o.status !== 'sincronizado').length;
  const panelOpen = app.tab !== 'mapa';

  return (
    <div className="relative h-full w-full overflow-hidden [--map-bottom:68px] lg:[--map-bottom:0px]">
      <MapScreen visible={app.tab === 'mapa'} />

      <header className="absolute inset-x-0 top-0 z-[700] px-3 pt-[calc(8px+var(--safe-t))] lg:left-3 lg:right-auto lg:top-3 lg:w-[420px] lg:px-0 lg:pt-0">
        <div className="flex h-12 items-center gap-2 rounded-2xl bg-surface/95 px-1.5 shadow-card backdrop-blur">
          <LogoBadge dark />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-bold">{unit?.name ?? 'Rescatista'}</div>
            <div className="truncate text-xs text-ink-3">{unit?.org ?? 'Equipo de respuesta'}, acceso de demostración</div>
          </div>
          <button
            onClick={() => app.setSheet({ kind: 'offline' })}
            className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold', app.online ? 'bg-ok-soft text-ok-ink' : 'bg-act text-on-act')}
            aria-label="Estado de conectividad"
          >
            {app.syncing ? <Loader2 size={15} className="animate-spin" /> : app.online ? <Wifi size={15} /> : <WifiOff size={15} />}
            {pending > 0 && <span className="font-data tnum">{pending}</span>}
          </button>
          <button onClick={() => app.setSheet({ kind: 'settings' })} className="grid h-9 w-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2" aria-label="Cuenta">
            <UserRound size={19} />
          </button>
        </div>
        {!app.online && (
          <button onClick={() => app.setSheet({ kind: 'offline' })} className="mt-1.5 flex w-full items-center gap-2 rounded-xl bg-act px-3 py-1.5 text-left text-sm font-semibold text-on-act shadow-card">
            <CloudOff size={15} />
            <span className="flex-1">Sin internet. Datos de {app.lastSync ? timeAgo(app.lastSync) : 'la última sincronización'}.</span>
          </button>
        )}
      </header>

      <main
        className={cx(
          !panelOpen && 'hidden',
          'fade-in absolute inset-0 z-[650] flex flex-col bg-paper pb-[calc(68px+var(--safe-b))]',
          app.online ? 'pt-[calc(64px+var(--safe-t))]' : 'pt-[calc(98px+var(--safe-t))]',
          'lg:bottom-3 lg:left-3 lg:right-auto lg:top-3 lg:w-[420px] lg:rounded-3xl lg:border lg:border-line lg:pb-[84px] lg:shadow-float',
          app.online ? 'lg:pt-[60px]' : 'lg:pt-[94px]',
        )}
      >
        <div className="min-h-0 flex-1">
          {app.tab === 'reportes' && <ReportsScreen />}
          {app.tab === 'alertas' && <AlertsScreen />}
          {app.tab === 'enlace' && <LinkScreen />}
        </div>
      </main>

      <nav className="absolute inset-x-0 bottom-0 z-[800] border-t border-line bg-surface pb-[var(--safe-b)] lg:bottom-3 lg:left-3 lg:right-auto lg:w-[420px] lg:rounded-3xl lg:border">
        <div className="flex h-[68px] items-stretch">
          <NavItem t="mapa" label="Mapa" Icon={MapIcon} />
          <NavItem t="reportes" label="Prioridades" Icon={ListOrdered} badge={app.incidents.filter((i) => i.assignedTo === app.session.unitId && i.attention !== 'resuelto').length} />
          <button onClick={() => setReporting(true)} className="flex flex-1 flex-col items-center justify-center" aria-label="Nuevo reporte">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-act text-on-act">
              <Plus size={26} strokeWidth={2.6} />
            </span>
          </button>
          <NavItem t="alertas" label="Alertas" Icon={BellRing} />
          <NavItem t="enlace" label="Enlace" Icon={Radio} />
        </div>
      </nav>

      {reporting && <ReportFlow onClose={() => setReporting(false)} />}
    </div>
  );
}

function NavItem({ t, label, Icon, badge }: { t: Tab; label: string; Icon: typeof MapIcon; badge?: number }) {
  const app = useApp();
  const on = app.tab === t;
  return (
    <button
      onClick={() => {
        app.setTab(t);
        if (t !== 'mapa') app.select(null);
      }}
      className={cx('relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold', on ? 'text-brand' : 'text-ink-3')}
      aria-current={on ? 'page' : undefined}
    >
      <Icon size={22} strokeWidth={on ? 2.5 : 2} />
      {label}
      {!!badge && <span className="absolute right-[calc(50%-22px)] top-1.5 rounded-full bg-act px-1.5 font-data text-[11px] text-on-act">{badge}</span>}
    </button>
  );
}

function LinkScreen() {
  const app = useApp();
  const pending = app.ops.filter((o) => o.status !== 'sincronizado');
  const node = radio.node();
  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-2">
      <h1 className="font-display text-3xl font-bold">Enlace</h1>
      <p className="text-sm text-ink-3">Cómo sale la información cuando falla internet.</p>

      <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
        <LinkRow
          Icon={app.online ? Wifi : WifiOff}
          title="Internet"
          detail={app.online ? `Conectado. Última sincronización ${app.lastSync ? timeAgo(app.lastSync) : 'nunca'}.` : 'Sin conexión. Los cambios quedan en cola.'}
          tone={app.online ? 'ok' : 'warn'}
          onClick={() => app.setSheet({ kind: 'offline' })}
        />
        <LinkRow
          Icon={Radio}
          title="Radio LoRa (Meshtastic)"
          detail={node ? `${node.longName}, ${node.neighbors} nodos vecinos` : 'Nodo desconectado. Adaptador simulado.'}
          tone={node ? 'ok' : 'idle'}
          onClick={() => app.setSheet({ kind: 'lora' })}
        />
        <LinkRow Icon={MessageSquare} title="SMS a la central" detail={`Número de demostración ${app.settings.smsNumber}`} tone="idle" onClick={() => app.setSheet({ kind: 'offline' })} />
      </div>

      <div className="mt-5 rounded-2xl border border-line p-4">
        <div className="flex items-baseline justify-between">
          <div className="font-semibold">Cola de sincronización</div>
          <div className="font-display text-3xl font-bold tnum">{pending.length}</div>
        </div>
        <p className="text-sm text-ink-3">Cambios hechos en este equipo que la central todavía no ha recibido.</p>
        {!app.online && (
          <Btn className="mt-3 w-full" variant="ok" onClick={app.simulateReconnect}>
            <RefreshCw size={18} /> Simular que volvió la conexión <SimTag className="bg-on-ok/15 text-on-ok">Demo</SimTag>
          </Btn>
        )}
      </div>
    </div>
  );
}

function LinkRow({ Icon, title, detail, tone, onClick }: { Icon: typeof Wifi; title: string; detail: string; tone: 'ok' | 'warn' | 'idle'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-2">
      <span className={cx('grid h-11 w-11 place-items-center rounded-xl', tone === 'ok' ? 'bg-ok-soft text-ok-ink' : tone === 'warn' ? 'bg-high-soft text-high-ink' : 'bg-surface-2 text-ink-2')}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-ink-3">{detail}</div>
      </div>
    </button>
  );
}

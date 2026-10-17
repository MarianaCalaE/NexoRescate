import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AppProvider, useApp } from './store';
import { CitizenApp, CitizenMenu, CitizenAlerts, AccessSheet } from './screens/CitizenApp';
import { Logo } from './components/Logo';
import { RescuerApp } from './screens/RescuerApp';
import { CentralDashboard } from './screens/CentralDashboard';
import { IncidentDetail } from './screens/IncidentDetail';
import { SmsSheet, LoraSheet, OfflinePanel, SettingsSheet } from './screens/Channels';
import { cx, ConfirmDialog } from './components/ui';
import { RegisterSheet } from './screens/Register';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const app = useApp();
  const role = app.session.role;
  const theme = role === 'ciudadano' ? 'citizen' : 'ops';

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'ops' ? '#180D22' : '#F7F4FA');
  }, [theme]);

  // Atajos de demostración: #central o #rescatista
  useEffect(() => {
    if (!app.ready) return;
    const apply = () => {
      const h = location.hash.replace('#', '');
      if (h === 'central') app.login('central');
      if (h === 'rescatista') app.login('rescatista', 'U-BOM2');
      if (h === 'ciudadano') app.logout();
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.ready]);

  // —— Confirmación de salida ——
  // 1) Cerrar o recargar la pestaña: aviso nativo del navegador si hay algo sin enviar.
  const pendingRef = useRef(false);
  pendingRef.current =
    !!app.draft.category ||
    app.incidents.some((i) => i.mine && (i.transmission === 'local' || i.transmission === 'pendiente')) ||
    app.incidents.some((i) => i.mine && !!i.smsPreparedAt && !i.sentVia?.includes('sms'));
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pendingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // 2) Botón «Atrás» (Android / navegador): cierra la vista abierta o pregunta antes de salir de la app.
  const appRef = useRef(app);
  appRef.current = app;
  useEffect(() => {
    if (!app.ready) return;
    const GUARD = { nrGuard: true };
    history.pushState(GUARD, '', location.href);
    let leaving = false;
    const onPop = async () => {
      if (leaving) return;
      const a = appRef.current;
      history.pushState(GUARD, '', location.href);
      if (a.confirmState) {
        a.confirmState.resolve(false);
        return;
      }
      if (a.backHandler.current) {
        a.backHandler.current();
        return;
      }
      if (a.sheet) {
        a.setSheet(null);
        return;
      }
      if (a.selectedId) {
        a.select(null);
        return;
      }
      const ok = await a.askConfirm({
        title: '¿Quieres salir de NexoRescate?',
        body: pendingRef.current
          ? 'Tienes reportes que aún no salen. Quedan guardados en el teléfono y se enviarán cuando vuelvas a abrir la app con conexión.'
          : 'Puedes volver cuando quieras. El mapa y tus reportes quedan guardados en el teléfono.',
        confirmLabel: 'Salir',
        cancelLabel: 'Quedarme',
      });
      if (ok) {
        leaving = true;
        history.go(-2);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [app.ready]);

  if (!app.ready)
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3 text-ink-3">
          <Logo className="h-16 w-auto" />
          <Loader2 className="animate-spin" />
        </div>
      </div>
    );

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper text-ink" data-theme={theme}>
      {role === 'ciudadano' && <CitizenApp />}
      {role === 'rescatista' && <RescuerApp />}
      {role === 'central' && <CentralDashboard />}

      {app.sheet?.kind === 'detail' && role !== 'ciudadano' && <IncidentDetail id={app.sheet.id} />}
      {app.sheet?.kind === 'sms' && <SmsSheet id={app.sheet.id} />}
      {app.sheet?.kind === 'lora' && role !== 'ciudadano' && <LoraSheet id={app.sheet.id} />}
      {app.sheet?.kind === 'offline' && <OfflinePanel />}
      {app.sheet?.kind === 'settings' && <SettingsSheet />}
      {app.sheet?.kind === 'mine' && <CitizenMenu />}
      {app.sheet?.kind === 'alerts' && <CitizenAlerts />}
      {app.sheet?.kind === 'access' && <AccessSheet />}
      {app.sheet?.kind === 'register' && <RegisterSheet />}
      {app.confirmState && (
        <ConfirmDialog
          title={app.confirmState.title}
          body={app.confirmState.body}
          confirmLabel={app.confirmState.confirmLabel}
          cancelLabel={app.confirmState.cancelLabel}
          danger={app.confirmState.danger}
          onAnswer={app.confirmState.resolve}
        />
      )}

      <Toasts />
    </div>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(72px+var(--safe-t))] z-[2000] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'sheet-enter max-w-md rounded-2xl px-4 py-3 text-[15px] font-semibold shadow-float',
            t.tone === 'ok' ? 'bg-ok text-on-ok' : t.tone === 'warn' ? 'bg-mod text-[#241034]' : t.tone === 'err' ? 'bg-crit text-white' : 'bg-ink text-paper',
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

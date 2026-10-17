import { useEffect, useState } from 'react';
import { MessageSquare, Copy, Info, Radio, Plug, Unplug, Send, Loader2, CheckCircle2, CircleDashed, ArrowDownLeft, ArrowUpRight, WifiOff, Wifi, Save, RefreshCw, Battery, RotateCcw, LogOut } from 'lucide-react';
import { useApp } from '../store';
import { buildSms, buildLoraPayload, byteLength } from '../services/compact';
import { radio, type NodeInfo } from '../services/radio';
import { CAT } from '../data/categories';
import { Sheet, Btn, Field, SimTag, TxBadge, copyText, fmtDate, timeAgo, cx, CatIcon } from '../components/ui';
import { cachedTileCount } from '../services/geo';

export function SmsSheet({ id }: { id: string }) {
  const app = useApp();
  const inc = app.incidents.find((i) => i.id === id);
  const citizen = app.session.role === 'ciudadano';
  const [number, setNumber] = useState(app.settings.smsNumber);
  const [showText, setShowText] = useState(false);
  if (!inc) return null;
  const msg = buildSms(inc);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
  const href = `sms:${number.replace(/[^\d+]/g, '')}${sep}body=${encodeURIComponent(msg)}`;
  const sent = !!inc.sentVia?.includes('sms');
  // La pregunta "¿se envió?" se guarda en el dispositivo: sobrevive a salir a la app de mensajes y volver.
  const waiting = !!inc.smsPreparedAt && !sent;

  const openSms = async () => {
    await app.prepareSms(inc.id);
    window.location.href = href;
  };
  const copy = async () => {
    const ok = await copyText(msg);
    app.toast(ok ? 'Mensaje copiado. Pégalo en un SMS al número indicado.' : 'No se pudo copiar. Mantén presionado el texto para copiarlo.', ok ? 'ok' : 'warn');
    if (ok) await app.prepareSms(inc.id);
  };
  const close = () => app.setSheet(null);

  if (citizen)
    return (
      <Sheet
        title={sent ? 'Reporte enviado por SMS' : waiting ? '¿Se envió el mensaje?' : 'Enviar reporte por SMS'}
        subtitle={sent || waiting ? undefined : 'Funciona con señal de celular, aunque no tengas internet.'}
        onClose={close}
      >
        {sent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-ok-soft p-4 text-ok-ink">
              <CheckCircle2 size={28} className="shrink-0" />
              <p className="text-base">La central lo confirmará cuando lo procese. Si vuelve el internet, también lo enviaremos por ahí.</p>
            </div>
            <Btn className="w-full" size="lg" onClick={close}>
              Listo
            </Btn>
          </div>
        ) : waiting ? (
          <div className="space-y-2">
            <p className="mb-3 text-base text-ink-2">Si en tu app de mensajes tocaste «Enviar», confírmalo aquí.</p>
            <Btn className="w-full" size="lg" onClick={() => app.confirmSms(inc.id, true)}>
              <CheckCircle2 size={22} /> Sí, lo envié
            </Btn>
            <Btn className="w-full" variant="secondary" size="lg" onClick={openSms}>
              <MessageSquare size={20} /> No, abrir mensajes otra vez
            </Btn>
            <button onClick={() => app.confirmSms(inc.id, false)} className="w-full py-3 text-base font-semibold text-ink-3">
              Lo enviaré después
            </button>
          </div>
        ) : (
          <div>
            <Btn className="w-full" variant="act" size="lg" onClick={openSms}>
              <MessageSquare size={24} /> Enviar reporte por SMS
            </Btn>
            <p className="mt-2 text-center text-sm text-ink-3">Se abrirá tu app de mensajes con el reporte listo. Solo toca «Enviar».</p>
            {!isMobile && <p className="mt-2 text-center text-sm text-ink-3">Este equipo puede no enviar SMS; usa un celular.</p>}
            <button onClick={() => setShowText(!showText)} className="mt-4 w-full py-2 text-sm font-semibold text-ink-3 underline" aria-expanded={showText}>
              ¿No se abrió la app de mensajes?
            </button>
            {showText && (
              <div className="mt-1 rounded-2xl bg-surface-2 p-3">
                <p className="text-sm text-ink-2">
                  Envía este texto al número <span className="font-data font-semibold tnum text-ink">{number}</span> (número de demostración):
                </p>
                <p className="mt-2 break-words text-[15px] leading-relaxed">{msg}</p>
                <Btn className="mt-2 w-full" variant="secondary" size="sm" onClick={copy}>
                  <Copy size={16} /> Copiar el mensaje
                </Btn>
              </div>
            )}
          </div>
        )}
      </Sheet>
    );

  return (
    <Sheet title="Enviar por SMS" subtitle="Requiere señal celular, no datos móviles" onClose={close}>
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <CatIcon id={inc.category} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{inc.title}</div>
          <div className="font-data text-sm tnum text-ink-3">{inc.id}</div>
        </div>
        <TxBadge inc={inc} />
      </div>
      <Field label="Número de la central" hint={<span className="inline-flex items-center gap-1"><SimTag>Configuración de demo</SimTag> No es un número real de emergencias.</span>}>
        <input
          id="nr-sms-number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onBlur={() => app.saveSettings({ smsNumber: number })}
          inputMode="tel"
          className="h-12 w-full rounded-2xl border border-line bg-surface px-3 font-data text-base tnum"
        />
      </Field>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-ink-2">
          <span>Mensaje compacto</span>
          <span className={cx('font-data tnum', msg.length > 160 ? 'text-crit-ink' : 'text-ink-3')}>{msg.length}/160</span>
        </div>
        <pre className="whitespace-pre-wrap break-all rounded-2xl bg-code p-3 font-data text-sm text-code-ink">{msg}</pre>
      </div>
      {waiting ? (
        <div className="mt-4 rounded-2xl border border-high/40 bg-high-soft p-3 text-high-ink">
          <div className="font-semibold">¿Salió el SMS?</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn variant="act" onClick={() => app.confirmSms(inc.id, true)}>
              Sí, se envió
            </Btn>
            <Btn variant="secondary" onClick={openSms}>
              Abrir otra vez
            </Btn>
          </div>
        </div>
      ) : sent ? (
        <div className="mt-4 rounded-2xl bg-info-soft p-3 text-sm text-info-ink">Enviado por SMS. Aún no hay confirmación de recepción en la central.</div>
      ) : (
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Btn variant="act" onClick={openSms}>
            <MessageSquare size={18} /> Enviar reporte por SMS
          </Btn>
          <Btn variant="secondary" onClick={copy}>
            <Copy size={16} />
          </Btn>
        </div>
      )}
      <div className="mt-5 flex gap-2 rounded-2xl bg-surface-2 p-3 text-xs text-ink-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>Una app web no puede enviar SMS sola: la persona debe tocar «Enviar». Una app nativa con permiso de SMS sí podría hacerlo automáticamente.</span>
      </div>
    </Sheet>
  );
}

export function LoraSheet({ id }: { id?: string }) {
  const app = useApp();
  const [status, setStatus] = useState(radio.status());
  const [node, setNode] = useState<NodeInfo | null>(radio.node());
  const [sel, setSel] = useState<string>(id ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => radio.onUpdate(() => setStatus(radio.status())), []);
  const candidates = app.incidents.filter((i) => i.mine || i.transmission !== 'recibido_central').slice(0, 30);
  const inc = app.incidents.find((i) => i.id === sel);
  const payload = inc ? buildLoraPayload(inc, app.assessments.get(inc.id)!.display) : '';

  const connect = async () => {
    setStatus('conectando');
    const n = await radio.connect();
    setNode(n);
    setStatus(radio.status());
    app.refresh();
  };
  const disconnect = async () => {
    await radio.disconnect();
    setNode(null);
    setStatus(radio.status());
    app.refresh();
  };
  const send = async () => {
    if (!inc) return;
    setBusy(true);
    try {
      await radio.send(inc.id, payload);
      await app.markSentByChannel(inc.id, 'lora', `${inc.id} entregado al nodo LoRa SIMULADO. Sin confirmación de la central.`);
      app.toast('Mensaje entregado al nodo simulado', 'ok');
    } catch (e) {
      app.toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const STATUS = {
    en_cola: { t: 'En cola del nodo', c: 'bg-surface-2 text-ink-2', i: CircleDashed },
    entregado_al_nodo: { t: 'Entregado al nodo (simulado)', c: 'bg-info-soft text-info-ink', i: Loader2 },
    ack_simulado: { t: 'Confirmación simulada', c: 'bg-ok-soft text-ok-ink', i: CheckCircle2 },
    sin_ack: { t: 'Sin confirmación', c: 'bg-high-soft text-high-ink', i: CircleDashed },
    error: { t: 'Error', c: 'bg-crit-soft text-crit-ink', i: CircleDashed },
  } as const;

  return (
    <Sheet title={<span className="flex flex-wrap items-center gap-2">Radio LoRa (Meshtastic) <SimTag>Adaptador simulado</SimTag></span>} subtitle="No hay una radio real conectada. Todos los resultados son simulados." onClose={() => app.setSheet(null)} full>
      <div className={cx('rounded-3xl p-4', status === 'conectado' ? 'bg-brand text-on-brand' : 'bg-surface-2')}>
        <div className="flex items-center gap-3">
          <span className={cx('grid h-12 w-12 place-items-center rounded-2xl', status === 'conectado' ? 'bg-on-brand/10' : 'bg-surface')}>
            <Radio size={24} className={status === 'conectado' ? 'text-code-ink' : 'text-ink-3'} />
          </span>
          <div className="flex-1">
            <div className="font-bold">{node ? node.longName : 'Nodo desconectado'}</div>
            <div className={cx('text-xs', status === 'conectado' ? 'text-on-brand/80' : 'text-ink-3')}>
              Estado: {status}
              {node && `, nodo ${node.id}, canal ${node.channel}`}
            </div>
          </div>
          {status === 'conectado' ? (
            <button onClick={disconnect} className="grid h-10 w-10 place-items-center rounded-md bg-on-brand/10" aria-label="Desconectar">
              <Unplug size={18} />
            </button>
          ) : (
            <Btn onClick={connect} disabled={status === 'conectando'} className="min-h-[40px]">
              {status === 'conectando' ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />} Conectar
            </Btn>
          )}
        </div>
        {node && (
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
            <Stat k="Batería" v={`${node.battery}%`} icon={<Battery size={12} />} />
            <Stat k="Vecinos" v={String(node.neighbors)} />
            <Stat k="SNR" v={`${node.snr} dB`} />
            <Stat k="HW" v="Simulado" />
          </div>
        )}
      </div>

      <div className="mt-5">
        <Field label="Reporte a transmitir">
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-surface px-3 text-sm">
            <option value="">Seleccionar incidente…</option>
            {candidates.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id}: {CAT[i.category].short}, {i.municipality}
              </option>
            ))}
          </select>
        </Field>
        {inc && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs font-bold text-ink-3">
              <span>Carga útil compacta</span>
              <span>
                {byteLength(payload)} / {radio.maxPayloadBytes} B
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-all rounded-2xl bg-code p-3 font-data tnum text-xs text-code-ink">{payload}</pre>
            <p className="mt-1 text-[11px] text-ink-3">Solo ID, categoría, ubicación, prioridad, estado y hora. Nunca fotos ni mapas.</p>
          </div>
        )}
        <Btn className="mt-3 w-full" onClick={send} disabled={!inc || status !== 'conectado' || busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {status !== 'conectado' ? 'Conecta el nodo para enviar' : 'Enviar mensaje de prueba'}
        </Btn>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs font-bold text-ink-3">Mensajes recientes</div>
        {app.lora.length === 0 && <div className="rounded-2xl bg-surface-2 p-4 text-center text-xs text-ink-3">Sin mensajes todavía.</div>}
        <div className="space-y-2">
          {app.lora.slice(0, 20).map((m) => {
            const S = STATUS[m.status];
            const I = S.i;
            return (
              <div key={m.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-center gap-2">
                  {m.direction === 'tx' ? <ArrowUpRight size={16} className="text-brand" /> : <ArrowDownLeft size={16} className="text-ok-ink" />}
                  <span className="font-data tnum text-xs font-bold">{m.id}</span>
                  <span className="text-[11px] text-ink-3">{m.incidentId}</span>
                  <span className={cx('ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold', S.c)}>
                    <I size={11} className={m.status === 'entregado_al_nodo' ? 'animate-spin' : ''} /> {S.t}
                  </span>
                </div>
                <div className="mt-1 break-all font-data tnum text-[10px] text-ink-3">{m.payload}</div>
                <div className="mt-1 text-[10px] text-ink-3">
                  {fmtDate(m.at)}, {m.bytes} bytes{m.hops ? `, ${m.hops} saltos` : ''}
                  {m.ackAt ? `, confirmación simulada a las ${new Date(m.ackAt).toLocaleTimeString('es-CO')}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex gap-2 rounded-2xl bg-surface-2 p-3 text-[11px] text-ink-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Una confirmación (ACK) de la malla indica que un nodo vecino recibió el paquete, no que la central lo haya registrado. Para una radio real se implementará un
          <code className="mx-1 rounded bg-surface px-1">RadioTransport</code>
          que hable con una pasarela local (Python + librería meshtastic) por USB‑serial o BLE.
        </span>
      </div>
    </Sheet>
  );
}

function Stat({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-on-brand/10 px-1 py-1.5">
      <div className="flex items-center justify-center gap-1 font-bold">
        {icon}
        {v}
      </div>
      <div className="opacity-70">{k}</div>
    </div>
  );
}

export function OfflinePanel() {
  const app = useApp();
  const citizen = app.session.role === 'ciudadano';
  const [tiles, setTiles] = useState<number | null>(null);
  useEffect(() => {
    cachedTileCount().then(setTiles);
  }, []);
  const mine = app.incidents.filter((i) => i.mine);
  const unsent = mine.filter((i) => i.transmission === 'local' || i.transmission === 'pendiente');
  const local = app.incidents.filter((i) => i.transmission !== 'recibido_central');
  const pending = app.ops.filter((o) => o.status !== 'sincronizado');
  const latest = [...unsent].sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <Sheet
      onClose={() => app.setSheet(null)}
      title={
        <span className="flex items-center gap-2">
          {app.online ? <Wifi size={22} className="text-ok" /> : <WifiOff size={22} className="text-act" />} {app.online ? 'Tienes conexión' : 'Sin conexión a internet'}
        </span>
      }
      subtitle={
        citizen
          ? app.online
            ? 'Tus reportes se envían apenas los registras.'
            : 'Puedes seguir usando la app. Lo que reportes queda guardado en tu teléfono.'
          : `Última sincronización ${app.lastSync ? timeAgo(app.lastSync) : 'nunca'}. La central de esta demo es simulada.`
      }
    >
      {citizen ? (
        <>
          {unsent.length > 0 ? (
            <div className="rounded-3xl bg-high-soft p-4 text-high-ink">
              <div className="text-lg font-bold">{unsent.length === 1 ? 'Tienes 1 reporte sin enviar' : `Tienes ${unsent.length} reportes sin enviar`}</div>
              <p className="mt-1 text-[15px]">Se enviarán solos cuando vuelva el internet. Si tienes señal de celular, envíalos ya por SMS.</p>
              {latest && (
                <Btn className="mt-3 w-full" variant="act" size="lg" onClick={() => app.setSheet({ kind: 'sms', id: latest.id })}>
                  <MessageSquare size={20} /> Enviar reporte por SMS
                </Btn>
              )}
            </div>
          ) : (
            <div className="rounded-3xl bg-ok-soft p-4 text-ok-ink">
              <div className="text-lg font-bold">No tienes reportes pendientes</div>
              <p className="mt-1 text-[15px]">El mapa y las alertas guardadas siguen disponibles sin internet.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Kpi v={String(local.length)} k="sin confirmar en la central" />
            <Kpi v={String(pending.length)} k="cambios en cola" />
            <Kpi v={tiles == null ? '…' : String(tiles)} k="teselas de mapa guardadas" />
          </div>
          {latest && (
            <div className="mt-5 space-y-2">
              <div className="text-sm font-semibold text-ink-2">Transmitir {latest.id}</div>
              <Btn className="w-full" onClick={() => app.setSheet({ kind: 'sms', id: latest.id })}>
                <MessageSquare size={18} /> Enviar por SMS
              </Btn>
              <Btn className="w-full" variant="secondary" onClick={() => app.setSheet({ kind: 'lora', id: latest.id })}>
                <Radio size={18} /> Enviar por LoRa
              </Btn>
              <Btn
                className="w-full"
                variant="secondary"
                onClick={async () => {
                  for (const i of mine.filter((x) => x.transmission === 'local')) await app.markPendingSend(i.id, `${i.id} guardado para enviar después`);
                  app.toast('Quedó en cola para enviar cuando haya conexión', 'ok');
                }}
              >
                <Save size={18} /> Guardar para enviar después
              </Btn>
            </div>
          )}
        </>
      )}

      <details className="group mt-6 rounded-2xl border border-dashed border-line p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-3">
          <SimTag>Demo</SimTag> Herramientas para la demostración
        </summary>
        <div className="mt-3 space-y-2">
          <Btn className="w-full" variant={app.settings.offlineDemo ? 'secondary' : 'outline'} onClick={() => app.saveSettings({ offlineDemo: !app.settings.offlineDemo })}>
            <WifiOff size={16} /> {app.settings.offlineDemo ? 'Salir del modo sin internet' : 'Simular que no hay internet'}
          </Btn>
          {!app.online && (
            <Btn className="w-full" variant="ok" onClick={app.simulateReconnect}>
              <RefreshCw size={16} /> Simular que volvió la conexión
            </Btn>
          )}
          {!app.browserOnline && <p className="text-xs text-ink-3">El navegador también indica que no hay red real.</p>}
        </div>
      </details>
    </Sheet>
  );
}

function Kpi({ v, k }: { v: string; k: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="font-display text-3xl font-bold leading-none tnum">{v}</div>
      <div className="mt-1 text-xs leading-tight text-ink-3">{k}</div>
    </div>
  );
}

export function SettingsSheet() {
  const app = useApp();
  const [confirm, setConfirm] = useState(false);
  const ops = app.session.role !== 'ciudadano';
  return (
    <Sheet title={ops ? app.session.name : 'Acerca de NexoRescate'} subtitle={ops ? 'Acceso de demostración. Sin credenciales reales.' : 'Del reporte a la respuesta, incluso sin internet.'} onClose={() => app.setSheet(null)}>
      {ops && (
        <Btn
          variant="outline"
          className="mb-4 w-full"
          onClick={async () => {
            const ok = await app.askConfirm({
              title: '¿Cerrar la sesión de equipo?',
              body: 'Volverás a la vista ciudadana. Los cambios ya guardados se conservan en este equipo.',
              confirmLabel: 'Cerrar sesión',
              cancelLabel: 'Seguir en la sesión',
            });
            if (ok) app.logout();
          }}
        >
          <LogOut size={18} /> Cerrar sesión y volver a la vista ciudadana
        </Btn>
      )}
      <p className="text-[15px] text-ink-2">Prototipo para el Rally Latinoamericano de Innovación. No es un sistema certificado de respuesta a emergencias. En una emergencia real llama al 123.</p>
      <dl className="mt-4 divide-y divide-line rounded-2xl border border-line text-sm">
        <Line k="Mapa" v="OpenStreetMap, Esri y OpenTopoMap, con copia en el dispositivo" />
        <Line k="Mapa sin internet" v="Natural Earth y zonas guardadas" />
        <Line k="Sismos reales" v="USGS, opcional" />
        <Line k="Incidentes y alertas" v="Ficticios, para la demostración" />
        <Line k="Central, SMS y LoRa" v="Central y nodo simulados; el SMS abre la app del teléfono" />
      </dl>
      <div className="mt-5">
        {confirm ? (
          <div className="rounded-2xl bg-crit-soft p-3 text-crit-ink">
            <p className="font-semibold">¿Restaurar los datos de demostración?</p>
            <p className="text-sm">Se borran los reportes creados, la cola y la bitácora de este dispositivo.</p>
            <div className="mt-2 flex gap-2">
              <Btn variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
                Cancelar
              </Btn>
              <Btn
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await app.resetDemo();
                  app.setSheet(null);
                }}
              >
                Restaurar
              </Btn>
            </div>
          </div>
        ) : (
          <Btn variant="secondary" className="w-full" onClick={() => setConfirm(true)}>
            <RotateCcw size={16} /> Restaurar datos de demostración
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2.5">
      <dt className="font-semibold">{k}</dt>
      <dd className="text-right text-ink-2">{v}</dd>
    </div>
  );
}

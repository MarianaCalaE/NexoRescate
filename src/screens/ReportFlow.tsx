import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X, LocateFixed, Camera, Trash2, Loader2, Check, MessageSquare, ChevronDown, MapPin, Search, Radio, WifiOff, IdCard } from 'lucide-react';
import { useApp } from '../store';
import { CAT } from '../data/categories';
import { CITIZEN_LABEL, PRIMARY_CATS, MORE_CATS, SAFETY_TIP, AFFECTED_OPTIONS } from '../data/safety';
import { reverseGeocode, searchLocal, searchNominatim, type GeoResult } from '../services/geo';
import { MapView } from '../components/MapView';
import { Btn, cx, TxBadge, timeAgo, SimTag } from '../components/ui';
import type { Incident, CategoryId } from '../types';
import { RegisterForm, maskDoc } from './Register';

type Step = 'que' | 'donde' | 'detalles' | 'listo';

/**
 * Flujo de reporte en tres pasos, una pregunta por pantalla.
 * Pensado para estrés: botones grandes, lenguaje simple, sin campos obligatorios
 * más allá del tipo y el lugar, y la ubicación se intenta obtener sola.
 */
export function ReportFlow({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const d = app.draft;
  const [step, setStep] = useState<Step>('que');
  const [more, setMore] = useState(false);
  const [gps, setGps] = useState<'idle' | 'buscando' | 'ok' | 'error'>('idle');
  const [label, setLabel] = useState<{ label: string; municipality: string } | null>(null);
  const [affIdx, setAffIdx] = useState(0);
  const [sending, setSending] = useState(false);
  const [dupAsk, setDupAsk] = useState<Incident[] | null>(null);
  const [askDoc, setAskDoc] = useState<null | { duplicateOf: string | null }>(null);
  const [created, setCreated] = useState<Incident | null>(null);
  const ops = app.session.role !== 'ciudadano';

  // Paso "dónde": activar selección en el mapa y pedir GPS automáticamente
  useEffect(() => {
    if (step !== 'donde') return;
    app.setPick({ active: true, lat: d.lat, lng: d.lng });
    if (d.lat != null) setTimeout(() => app.flyTo(d.lat!, d.lng!, 16), 60);
    if (d.lat == null && gps === 'idle') {
      setGps('buscando');
      app.locate({ silent: true }).then((p) => {
        if (p) {
          setGps('ok');
          app.setDraft({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), accuracyM: p.accuracy, locationPrecision: 'gps' });
          app.setPick({ active: true, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
          app.flyTo(p.lat, p.lng, 16);
        } else setGps('error');
      });
    }
    return () => app.setPick({ active: false, lat: null, lng: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Si la persona toca el mapa, la ubicación pasa a ser "marcada en mapa"
  const { lat: pLat, lng: pLng, active } = app.pick;
  useEffect(() => {
    if (!active || pLat == null || pLng == null) return;
    if (pLat !== d.lat || pLng !== d.lng) app.setDraft({ lat: pLat, lng: pLng, locationPrecision: 'manual', accuracyM: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pLat, pLng, active]);

  useEffect(() => {
    setLabel(null);
    if (d.lat == null || d.lng == null) return;
    const t = setTimeout(() => reverseGeocode(d.lat!, d.lng!).then(setLabel), 500);
    return () => clearTimeout(t);
  }, [d.lat, d.lng]);

  const forceClose = () => {
    app.setPick({ active: false, lat: null, lng: null });
    app.resetDraft();
    onClose();
  };
  /** Salir del reporte: si ya hay algo escrito o elegido, pedir confirmación. */
  const close = async () => {
    if (step === 'listo' || !d.category) return forceClose();
    const ok = await app.askConfirm({
      title: '¿Salir sin enviar el reporte?',
      body: 'Lo que llevas se va a perder y la emergencia no quedará reportada.',
      confirmLabel: 'Salir sin enviar',
      cancelLabel: 'Seguir reportando',
      danger: true,
    });
    if (ok) forceClose();
  };

  // Botón «Atrás» del teléfono: retrocede un paso; en el primero, pregunta antes de salir.
  const stepRef = useRef(step);
  stepRef.current = step;
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    app.backHandler.current = () => {
      const st = stepRef.current;
      if (st === 'detalles') setStep('donde');
      else if (st === 'donde') setStep('que');
      else closeRef.current();
    };
    return () => {
      app.backHandler.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = async () => {
    setGps('buscando');
    const p = await app.locate({ silent: true });
    if (p) {
      setGps('ok');
      app.setDraft({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), accuracyM: p.accuracy, locationPrecision: 'gps' });
      app.setPick({ active: true, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      app.flyTo(p.lat, p.lng, 16);
    } else setGps('error');
  };

  const chooseCat = (c: CategoryId) => {
    app.setDraft({ category: c, infrastructure: CAT[c].defaultInfra ?? [] });
    setStep('donde');
  };

  const send = async (duplicateOf: string | null) => {
    if (sending) return;
    setSending(true);
    setDupAsk(null);
    try {
      const inc = await app.createIncident({
        ...d,
        affected: AFFECTED_OPTIONS[affIdx].value,
        locationLabel: d.address.trim() || label?.label || d.locationLabel,
        municipality: label?.municipality ?? d.municipality,
        duplicateOf,
      });
      setCreated(inc);
      setStep('listo');
      // Sin internet: intentar automáticamente por radio LoRa (nodo más cercano, simulado).
      if (!app.online) app.autoRelay(inc.id);
    } catch {
      app.toast('No se pudo guardar el reporte. Intenta de nuevo.', 'err');
    } finally {
      setSending(false);
    }
  };
  /** Antes de enviar: los ciudadanos sin registro deben registrar su documento (una sola vez). */
  const sendChecked = (duplicateOf: string | null) => {
    setDupAsk(null);
    if (!ops && !app.profile) setAskDoc({ duplicateOf });
    else send(duplicateOf);
  };
  const trySend = () => {
    const dups = app.findDuplicates(d);
    if (dups.length && dupAsk === null) setDupAsk(dups);
    else sendChecked(null);
  };

  const live = created ? app.incidents.find((i) => i.id === created.id) ?? created : null;
  const stepIdx = ['que', 'donde', 'detalles'].indexOf(step);
  const back = () => setStep(step === 'detalles' ? 'donde' : 'que');

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-paper fade-in [--map-bottom:0px]">
      {/* Encabezado */}
      {step !== 'listo' && (
        <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(12px+var(--safe-t))]">
          {stepIdx > 0 ? (
            <button onClick={back} className="grid h-12 w-12 place-items-center rounded-full bg-surface text-ink shadow-card" aria-label="Volver">
              <ArrowLeft size={22} />
            </button>
          ) : (
            <span className="w-12" />
          )}
          <div className="flex flex-1 justify-center gap-1.5" aria-label={`Paso ${stepIdx + 1} de 3`}>
            {[0, 1, 2].map((k) => (
              <span key={k} className={cx('h-2 rounded-full transition-all', k === stepIdx ? 'w-8 bg-ink' : k < stepIdx ? 'w-2 bg-ink' : 'w-2 bg-line')} />
            ))}
          </div>
          <button onClick={close} className="grid h-12 w-12 place-items-center rounded-full bg-surface text-ink-2 shadow-card" aria-label="Cancelar reporte">
            <X size={22} />
          </button>
        </div>
      )}

      {/* Paso 1 */}
      {step === 'que' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <h1 className="px-1 pt-2 font-display text-[34px] font-bold leading-[1.05]">¿Qué está pasando?</h1>
          <p className="mt-1 px-1 text-base text-ink-2">Elige lo que más se parezca. Podrás agregar detalles después.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PRIMARY_CATS.map((c) => (
              <CatTile key={c} id={c} onClick={() => chooseCat(c)} selected={d.category === c} />
            ))}
          </div>
          <button onClick={() => setMore(!more)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-2xl py-3 text-base font-semibold text-ink-2" aria-expanded={more}>
            Otra cosa <ChevronDown size={18} className={cx('transition', more && 'rotate-180')} />
          </button>
          {more && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {MORE_CATS.map((c) => (
                <CatTile key={c} id={c} onClick={() => chooseCat(c)} selected={d.category === c} small />
              ))}
            </div>
          )}
          {!ops && (
            <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-[15px] text-ink-2">
              Si una vida corre peligro ahora mismo, llama también al{' '}
              <a href="tel:123" className="font-bold text-ink underline">
                123
              </a>
              .
            </p>
          )}
        </div>
      )}

      {/* Paso 2 */}
      {step === 'donde' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-5 pb-2">
            <h1 className="font-display text-[34px] font-bold leading-[1.05]">¿Dónde es?</h1>
            <p className="mt-1 text-base text-ink-2">Escribe la dirección o un lugar conocido, usa tu ubicación o toca el mapa.</p>
          </div>

          <div className="shrink-0 px-4 pb-2">
            <AddressInput
              value={d.address}
              onChange={(v) => app.setDraft({ address: v })}
              onPick={(r) => {
                app.setDraft({ lat: +r.lat.toFixed(6), lng: +r.lng.toFixed(6), accuracyM: null, locationPrecision: r.source === 'osm' ? 'manual' : 'aproximada', address: r.name });
                app.setPick({ active: true, lat: +r.lat.toFixed(6), lng: +r.lng.toFixed(6) });
                app.flyTo(r.lat, r.lng, r.source === 'osm' ? 17 : 15);
              }}
            />
            <button
              onClick={useMyLocation}
              className={cx(
                'mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 text-base font-bold',
                d.locationPrecision === 'gps' ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink',
              )}
            >
              {gps === 'buscando' ? <Loader2 size={20} className="animate-spin" /> : <LocateFixed size={20} />}
              {gps === 'buscando' ? 'Buscando tu ubicación…' : d.locationPrecision === 'gps' ? 'Usando tu ubicación actual' : 'Usar tu ubicación actual'}
            </button>
            {gps === 'error' && (
              <p className="mt-1.5 text-[15px] text-ink-2">
                {app.locPerm === 'denied' ? 'La ubicación está bloqueada en este teléfono.' : 'No encontramos tu ubicación.'} Escribe la dirección o toca el mapa.{' '}
                {app.locProblem && (
                  <button onClick={() => app.setSheet({ kind: 'location-help', reason: app.locProblem! })} className="font-semibold text-brand underline">
                    Más opciones
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="relative mx-3 min-h-[140px] flex-1 overflow-hidden rounded-[24px] border border-line">
            <MapView incidents={[]} variant="citizen" baseLayer={app.settings.baseLayer} />
          </div>

          <div className="shrink-0 px-4 pb-[calc(16px+var(--safe-b))] pt-3">
            <div className="mb-3 flex min-h-[44px] items-start gap-2 px-1">
              <MapPin size={20} className="mt-0.5 shrink-0 text-act" />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">
                  {d.address.trim() || (d.lat == null ? 'Sin ubicación todavía' : label?.label ?? 'Ubicando…')}
                </div>
                <div className="truncate text-sm text-ink-3">
                  {d.lat == null
                    ? d.address.trim()
                      ? 'Sin punto en el mapa: el equipo usará la dirección escrita'
                      : 'Escribe una dirección o marca el punto'
                    : `${d.locationPrecision === 'gps' ? `Tu ubicación${d.accuracyM ? `, precisión de ${Math.round(d.accuracyM)} m` : ''}` : d.locationPrecision === 'aproximada' ? 'Ubicación aproximada' : 'Marcado en el mapa'}${label?.municipality ? `, ${label.municipality}` : ''}`}
                </div>
              </div>
            </div>
            <Btn className="w-full" size="lg" onClick={() => setStep('detalles')} disabled={d.lat == null && d.address.trim().length < 4}>
              <Check size={22} /> Continuar
            </Btn>
          </div>
        </div>
      )}

      {/* Paso 3 */}
      {step === 'detalles' && d.category && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <h1 className="font-display text-[34px] font-bold leading-[1.05]">¿Cuántas personas necesitan ayuda?</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {AFFECTED_OPTIONS.map((o, k) => (
                <button
                  key={o.label}
                  onClick={() => setAffIdx(k)}
                  aria-pressed={affIdx === k}
                  className={cx('min-h-[52px] min-w-[64px] rounded-2xl border-2 px-4 text-lg font-semibold', affIdx === k ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink')}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <label className="mt-6 block">
              <span className="text-base font-semibold">¿Algo más que debamos saber? (opcional)</span>
              <textarea
                value={d.description}
                maxLength={280}
                onChange={(e) => app.setDraft({ description: e.target.value })}
                rows={3}
                placeholder="Por ejemplo: hay dos carros atrapados en la vía."
                className="mt-2 w-full rounded-2xl border-2 border-line bg-surface p-3 text-base outline-none focus:border-brand"
              />
              <span className="text-sm text-ink-3">No escribas nombres, teléfonos ni documentos.</span>
            </label>

            <div className="mt-4">
              {d.photo ? (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-2">
                  <img src={d.photo} alt="Foto que vas a enviar" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1 text-base font-semibold">Foto agregada</div>
                  <button onClick={() => app.setDraft({ photo: null })} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-crit" aria-label="Quitar foto">
                    <Trash2 size={20} />
                  </button>
                </div>
              ) : (
                <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-base font-semibold text-ink-2">
                  <Camera size={20} /> Agregar foto (opcional)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          app.setDraft({ photo: await compressImage(f) });
                        } catch {
                          app.toast('No se pudo usar esa foto. Puedes enviar el reporte sin ella.', 'warn');
                        }
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="relative z-10 shrink-0 border-t border-line bg-surface px-4 pb-[calc(16px+var(--safe-b))] pt-3">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: CAT[d.category].color }}>
                {(() => {
                  const I = CAT[d.category].icon;
                  return <I size={20} />;
                })()}
              </span>
              <div className="min-w-0 text-sm">
                <div className="truncate font-semibold">{CITIZEN_LABEL[d.category]}</div>
                <div className="truncate text-ink-3">{d.address.trim() || label?.label || d.locationLabel || 'Ubicación marcada'}</div>
              </div>
            </div>
            <Btn className="w-full" variant="act" size="lg" onClick={trySend} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : null} Enviar reporte
            </Btn>
            {!ops && (
              <button onClick={() => app.setSheet({ kind: 'register' })} className="mt-2 flex w-full items-center justify-center gap-1.5 text-sm text-ink-3">
                <IdCard size={15} />
                {app.profile ? (
                  <>
                    <span>
                      Reportas con <span className="font-data font-semibold tnum">{maskDoc(app.profile)}</span>.
                    </span>
                    <span className="underline">Cambiar</span>
                  </>
                ) : (
                  'Al enviar te pediremos tu número de cédula (una sola vez)'
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmación */}
      {step === 'listo' && live && <Done inc={live} onClose={close} ops={ops} />}

      {dupAsk && (
        <div className="fixed inset-0 z-[950] flex items-end bg-[rgb(6_20_24/.5)] fade-in sm:items-center sm:justify-center">
          <div className="sheet-enter w-full rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-b))] sm:max-w-md sm:rounded-[28px]">
            <h2 className="font-display text-[28px] font-bold leading-tight">Alguien ya reportó algo parecido aquí</h2>
            <p className="mt-2 text-base text-ink-2">
              {CITIZEN_LABEL[dupAsk[0].category]}, {timeAgo(dupAsk[0].createdAt)}. ¿Es la misma emergencia?
            </p>
            <div className="mt-5 space-y-2">
              <Btn className="w-full" size="lg" onClick={() => sendChecked(dupAsk[0].id)}>
                Sí, es la misma
              </Btn>
              <Btn className="w-full" variant="secondary" size="lg" onClick={() => sendChecked(null)}>
                No, es otra emergencia
              </Btn>
            </div>
            <p className="mt-3 text-sm text-ink-3">Igual guardamos tu reporte. Sirve para confirmar lo que pasa.</p>
          </div>
        </div>
      )}

      {askDoc && (
        <div className="fixed inset-0 z-[950] flex items-end bg-[rgb(6_20_24/.5)] fade-in sm:items-center sm:justify-center">
          <div className="sheet-enter max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-b))] sm:max-w-md sm:rounded-[28px]">
            <div className="flex items-start gap-3">
              <h2 className="flex-1 font-display text-[28px] font-bold leading-tight">Antes de enviar: tu cédula</h2>
              <button onClick={() => setAskDoc(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2" aria-label="Volver al reporte">
                <X size={20} />
              </button>
            </div>
            <p className="mb-4 mt-1 text-base text-ink-2">Solo te la pedimos una vez. Ayuda a los equipos a verificar el reporte y a contactarte por canales oficiales.</p>
            <RegisterForm
              submitLabel="Guardar y enviar reporte"
              onDone={() => {
                const dup = askDoc.duplicateOf;
                setAskDoc(null);
                send(dup);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Campo de dirección con sugerencias: lugares del Chocó (sin internet) y OpenStreetMap (con internet). */
function AddressInput({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (r: GeoResult) => void }) {
  const app = useApp();
  const [focus, setFocus] = useState(false);
  const [osm, setOsm] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const local = useMemo(() => searchLocal(value), [value]);
  useEffect(() => {
    setOsm([]);
    if (!app.online || value.trim().length < 4) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        setOsm(await searchNominatim(value.trim(), ctrl.signal));
      } catch {
        /* sin sugerencias en línea */
      } finally {
        setBusy(false);
      }
    }, 900);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, app.online]);
  const results = [...local, ...osm].slice(0, 6);
  return (
    <div className="relative">
      <label htmlFor="nr-address" className="sr-only">
        Dirección o lugar de referencia
      </label>
      <div className="flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3 focus-within:border-brand">
        <Search size={20} className="shrink-0 text-ink-3" />
        <input
          id="nr-address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 200)}
          placeholder="Dirección, barrio o lugar conocido"
          autoComplete="street-address"
          enterKeyHint="done"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
        {busy && <Loader2 size={18} className="shrink-0 animate-spin text-ink-3" />}
        {value && (
          <button onClick={() => onChange('')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3" aria-label="Borrar dirección">
            <X size={18} />
          </button>
        )}
      </div>
      {focus && results.length > 0 && (
        <ul className="absolute inset-x-0 top-[62px] z-[700] max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-float">
          {results.map((r, k) => (
            <li key={k}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(r);
                  setFocus(false);
                }}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-surface-2"
              >
                <MapPin size={18} className="shrink-0 text-act" />
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">{r.name}</span>
                  <span className="block truncate text-sm text-ink-3">{r.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {focus && value.trim().length >= 3 && results.length === 0 && !busy && (
        <p className="mt-1 px-1 text-sm text-ink-3">Sin coincidencias. Puedes dejar la dirección escrita así y marcar el punto en el mapa si lo conoces.</p>
      )}
    </div>
  );
}

function CatTile({ id, onClick, selected, small }: { id: CategoryId; onClick: () => void; selected?: boolean; small?: boolean }) {
  const c = CAT[id];
  const Icon = c.icon;
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex flex-col items-start justify-between gap-3 rounded-[22px] border-2 bg-surface p-4 text-left transition active:scale-[.97]',
        small ? 'min-h-[104px]' : 'min-h-[128px]',
        selected ? 'border-ink' : 'border-transparent shadow-card',
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: c.color }}>
        <Icon size={26} strokeWidth={2.2} />
      </span>
      <span className="text-[17px] font-bold leading-snug">{CITIZEN_LABEL[id]}</span>
    </button>
  );
}

function Done({ inc, onClose, ops }: { inc: Incident; onClose: () => void; ops: boolean }) {
  const app = useApp();
  const received = inc.transmission === 'recibido_central';
  const offline = !app.online && !received;
  const tip = useMemo(() => SAFETY_TIP[inc.category], [inc.category]);
  const relay = app.relay[inc.id];
  const smsSent = inc.sentVia?.includes('sms');

  if (!offline)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(20px+var(--safe-b))] pt-[calc(40px+var(--safe-t))]">
        <div className={cx('grid h-20 w-20 place-items-center rounded-full', received ? 'bg-ok text-on-ok' : 'bg-brand-soft text-brand')}>
          {received ? <Check size={44} strokeWidth={3} /> : <Loader2 size={36} className="animate-spin" />}
        </div>
        <h1 className="mt-5 font-display text-[38px] font-bold leading-[1.05]">{received ? 'Recibimos tu reporte' : 'Enviando tu reporte…'}</h1>
        <p className="mt-2 text-lg text-ink-2">{received ? 'Un equipo lo va a revisar. (En esta demostración, la central es simulada.)' : 'Estamos conectando con la central.'}</p>
        <Code inc={inc} ops={ops} />
        {!ops && <Tip tip={tip} />}
        <div className="mt-auto pt-8">
          <Btn className="w-full" size="lg" onClick={onClose}>
            Listo
          </Btn>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(20px+var(--safe-b))] pt-[calc(28px+var(--safe-t))]">
      <h1 className="font-display text-[34px] font-bold leading-[1.05]">Tu reporte quedó guardado</h1>
      <p className="mt-2 text-lg text-ink-2">No hay internet. Envíalo ahora por SMS: funciona con señal de celular, sin datos.</p>

      {smsSent ? (
        <div className="mt-5 flex items-center gap-3 rounded-[22px] bg-ok-soft p-4 text-ok-ink">
          <Check size={28} strokeWidth={3} className="shrink-0" />
          <div>
            <div className="text-lg font-bold">Reporte enviado por SMS</div>
            <div className="text-[15px]">La central lo confirmará cuando lo procese.</div>
          </div>
        </div>
      ) : (
        <Btn className="mt-5 w-full" variant="act" size="lg" onClick={() => app.setSheet({ kind: 'sms', id: inc.id })}>
          <MessageSquare size={24} /> Enviar reporte por SMS
        </Btn>
      )}

      <ul className="mt-4 divide-y divide-line rounded-[22px] border border-line bg-surface" aria-label="Canales de envío">
        <ChannelRow
          icon={<Radio size={20} />}
          title="Radio comunitaria (LoRa)"
          tag="Simulado"
          state={
            !relay
              ? { tone: 'wait', text: 'Preparando envío automático…' }
              : relay.lora === 'buscando'
                ? { tone: 'wait', text: 'Buscando el nodo de radio más cercano…' }
                : relay.lora === 'conectando'
                  ? { tone: 'wait', text: `Conectando con ${relay.node}${relay.km != null ? ` (${fmtKm(relay.km)})` : ''}…` }
                  : relay.lora === 'enviando'
                    ? { tone: 'wait', text: `Enviando por ${relay.node}…` }
                    : relay.lora === 'entregado'
                      ? { tone: 'ok', text: `Enviado por ${relay.node}. Esperando confirmación de la red.` }
                      : relay.lora === 'confirmado'
                        ? { tone: 'ok', text: `La red de radio recibió tu reporte (${relay.node}).` }
                        : relay.lora === 'sin_ack'
                          ? { tone: 'warn', text: 'Salió por radio, pero nadie confirmó. Envíalo también por SMS.' }
                          : relay.lora === 'sin_nodo'
                            ? { tone: 'warn', text: 'No hay un nodo de radio cerca. Usa el SMS.' }
                            : { tone: 'warn', text: 'No se pudo enviar por radio. Usa el SMS.' }
          }
        />
        <ChannelRow icon={<WifiOff size={20} />} title="Internet" state={{ tone: 'idle', text: 'Se enviará solo cuando vuelva la conexión.' }} />
      </ul>

      <Code inc={inc} ops={ops} />
      {!ops && <Tip tip={tip} />}

      <div className="mt-auto pt-6">
        <Btn className="w-full" variant="secondary" size="lg" onClick={onClose}>
          Listo
        </Btn>
      </div>
    </div>
  );
}

function fmtKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

function ChannelRow({ icon, title, tag, state }: { icon: React.ReactNode; title: string; tag?: string; state: { tone: 'wait' | 'ok' | 'warn' | 'idle'; text: string } }) {
  return (
    <li className="flex items-start gap-3 p-4">
      <span
        className={cx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          state.tone === 'ok' ? 'bg-ok-soft text-ok-ink' : state.tone === 'warn' ? 'bg-high-soft text-high-ink' : 'bg-surface-2 text-ink-2',
        )}
      >
        {state.tone === 'wait' ? <Loader2 size={20} className="animate-spin" /> : state.tone === 'ok' ? <Check size={20} strokeWidth={3} /> : icon}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-base font-bold">
          {title} {tag && <SimTag>{tag}</SimTag>}
        </div>
        <div className="text-[15px] text-ink-2">{state.text}</div>
      </div>
    </li>
  );
}

function Code({ inc, ops }: { inc: Incident; ops: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-base text-ink-3">
      Código de seguimiento <span className="font-data text-lg font-semibold tnum text-ink">{inc.id}</span>
      {ops && <TxBadge inc={inc} />}
    </div>
  );
}

function Tip({ tip }: { tip: string }) {
  return (
    <div className="mt-5 rounded-[22px] bg-surface p-4 shadow-card">
      <div className="text-base font-bold">Mientras llega la ayuda</div>
      <p className="mt-1 text-[17px] leading-relaxed text-ink-2">{tip}</p>
    </div>
  );
}

async function compressImage(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72); // re-codificar elimina metadatos EXIF (incluida la ubicación)
  } finally {
    URL.revokeObjectURL(url);
  }
}

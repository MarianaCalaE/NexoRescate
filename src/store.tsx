import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Incident, SyncOp, LogEntry, Settings, OfficialAlert, LoraMessage, Attention, Session, Role, Verification, Profile } from './types';
import { UNIT } from './data/units';
import * as DB from './services/db';
import { enqueue, getOps, runSync } from './services/sync';
import { assess, type Assessment } from './lib/priority';
import { DemoAlertsAdapter, UsgsEarthquakeAdapter } from './services/alerts';
import { getLoraMessages, radio, nearestNodes } from './services/radio';
import { buildLoraPayload } from './services/compact';
import { haversineKm } from './data/places';
import { CAT } from './data/categories';

export type Tab = 'mapa' | 'alertas' | 'reportar' | 'reportes' | 'enlace';
export type Sheet = null | { kind: 'detail'; id: string } | { kind: 'sms'; id: string } | { kind: 'lora'; id?: string } | { kind: 'offline' } | { kind: 'settings' } | { kind: 'access' } | { kind: 'mine' } | { kind: 'alerts' } | { kind: 'register' } | { kind: 'location-help'; reason: LocationProblem };

export interface Draft {
  draftId: string;
  category: Incident['category'] | null;
  description: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  locationPrecision: Incident['locationPrecision'];
  locationLabel: string;
  municipality: string;
  affected: number | null;
  photo: string | null;
  infrastructure: NonNullable<Incident['infrastructure']>;
  duplicateOf: string | null;
  address: string;
}

export type LocationProblem = 'denegado' | 'no_disponible' | 'inseguro' | 'no_soportado' | 'navegador_app';
export const LOCATION_MESSAGES: Record<LocationProblem, string> = {
  denegado: 'El navegador no tiene permiso para usar tu ubicación.',
  no_disponible: 'El teléfono no encontró tu ubicación.',
  inseguro: 'La ubicación solo funciona en páginas seguras (https).',
  no_soportado: 'Este navegador no ofrece ubicación.',
  navegador_app: 'El navegador dentro de esta app no comparte la ubicación.',
};
/** Navegadores incrustados (WhatsApp, Instagram, Facebook, TikTok…) suelen bloquear la ubicación. */
/** Abre la misma página en el navegador del sistema (Chrome en Android, Safari en iPhone). */
export function openInSystemBrowser() {
  const url = location.href;
  if (/Android/i.test(navigator.userAgent)) {
    const noScheme = url.replace(/^https?:\/\//, '');
    location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  } else {
    location.href = url.replace(/^https:\/\//, 'x-safari-https://');
  }
}

export function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|TikTok|Snapchat|Twitter|; wv\)/i.test(navigator.userAgent);
}

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface RelayState {
  lora: 'buscando' | 'conectando' | 'enviando' | 'entregado' | 'confirmado' | 'sin_ack' | 'sin_nodo' | 'error';
  node?: string;
  km?: number;
}

export interface UserPos {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

interface Ctx {
  ready: boolean;
  session: Session;
  login: (role: Role, unitId?: string) => Promise<void>;
  logout: () => Promise<void>;
  assignUnit: (id: string, unitId: string | null) => Promise<void>;
  verify: (id: string, v: Verification) => Promise<void>;
  fieldNote: (id: string, text: string) => Promise<void>;
  incidents: Incident[];
  assessments: Map<string, Assessment>;
  duplicatesOf: Map<string, Incident[]>;
  ops: SyncOp[];
  log: LogEntry[];
  lora: LoraMessage[];
  settings: Settings;
  online: boolean;
  browserOnline: boolean;
  lastSync: number;
  syncing: boolean;
  alerts: OfficialAlert[];
  usgs: { items: OfficialAlert[]; status: 'idle' | 'loading' | 'ok' | 'error' | 'offline'; at?: number; error?: string };
  tab: Tab;
  setTab: (t: Tab) => void;
  sheet: Sheet;
  setSheet: (s: Sheet) => void;
  selectedId: string | null;
  select: (id: string | null, fly?: boolean) => void;
  flyTarget: { lat: number; lng: number; zoom?: number; key: number } | null;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  userPos: UserPos | null;
  geoError: string | null;
  locate: (opts?: { silent?: boolean }) => Promise<UserPos | null>;
  locating: boolean;
  /** Estado del permiso de ubicación del navegador. */
  locPerm: 'granted' | 'prompt' | 'denied' | 'unknown';
  locProblem: LocationProblem | null;
  pick: { active: boolean; lat: number | null; lng: number | null };
  setPick: (p: { active: boolean; lat: number | null; lng: number | null }) => void;
  draft: Draft;
  setDraft: (d: Partial<Draft>) => void;
  resetDraft: () => void;
  createIncident: (d: Draft) => Promise<Incident>;
  updateIncident: (id: string, patch: Partial<Incident>, summary: string, type?: SyncOp['type']) => Promise<void>;
  confirmActive: (id: string) => Promise<void>;
  contribute: (id: string, text: string) => Promise<void>;
  setAttention: (id: string, a: Attention, by: 'ciudadano' | 'equipo') => Promise<void>;
  markPendingSend: (id: string, note: string) => Promise<void>;
  markSentByChannel: (id: string, channel: 'sms' | 'lora', note: string) => Promise<void>;
  prepareSms: (id: string) => Promise<void>;
  confirmSms: (id: string, sent: boolean) => Promise<void>;
  relay: Record<string, RelayState>;
  autoRelay: (id: string) => Promise<void>;
  saveSettings: (s: Partial<Settings>) => Promise<void>;
  simulateReconnect: () => Promise<void>;
  resetDemo: () => Promise<void>;
  refresh: () => Promise<void>;
  loadUsgs: () => Promise<void>;
  findDuplicates: (d: Pick<Draft, 'category' | 'lat' | 'lng'>) => Incident[];
  toast: (msg: string, tone?: 'ok' | 'warn' | 'err' | 'info') => void;
  toasts: { id: number; msg: string; tone: string }[];
  profile: Profile | null;
  saveProfile: (p: Profile) => Promise<void>;
  clearProfile: () => Promise<void>;
  confirmState: ConfirmRequest | null;
  askConfirm: (req: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  /** Manejador del botón Atrás (lo registra la vista abierta, p. ej. el reporte). */
  backHandler: React.MutableRefObject<(() => void) | null>;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

const emptyDraft = (): Draft => ({
  draftId: DB.newIncidentId(),
  category: null,
  description: '',
  lat: null,
  lng: null,
  accuracyM: null,
  locationPrecision: 'desconocida',
  locationLabel: '',
  municipality: '',
  affected: null,
  photo: null,
  infrastructure: [],
  duplicateOf: null,
  address: '',
});

const CITIZEN: Session = { role: 'ciudadano', name: 'Ciudadano' };

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session>(CITIZEN);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [ops, setOps] = useState<SyncOp[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lora, setLora] = useState<LoraMessage[]>([]);
  const [settings, setSettings] = useState<Settings>(DB.DEFAULT_SETTINGS);
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [alerts, setAlerts] = useState<OfficialAlert[]>([]);
  const [usgs, setUsgs] = useState<Ctx['usgs']>({ items: [], status: 'idle' });
  const [tab, setTab] = useState<Tab>('mapa');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<Ctx['flyTarget']>(null);
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locPerm, setLocPerm] = useState<Ctx['locPerm']>('unknown');
  const [locProblem, setLocProblem] = useState<LocationProblem | null>(null);
  const [pick, setPick] = useState<Ctx['pick']>({ active: false, lat: null, lng: null });
  const [draft, setDraftState] = useState<Draft>(emptyDraft);
  const [toasts, setToasts] = useState<Ctx['toasts']>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmRequest | null>(null);
  const backHandler = useRef<(() => void) | null>(null);
  const askConfirm = useCallback(
    (req: Omit<ConfirmRequest, 'resolve'>) =>
      new Promise<boolean>((resolve) =>
        setConfirmState({
          ...req,
          resolve: (ok) => {
            setConfirmState(null);
            resolve(ok);
          },
        }),
      ),
    [],
  );
  const [now, setNow] = useState(Date.now());

  const online = browserOnline && !settings.offlineDemo;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const toast = useCallback((msg: string, tone: 'ok' | 'warn' | 'err' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const refresh = useCallback(async () => {
    const [inc, o, l, lr, ls] = await Promise.all([DB.getAllIncidents(), getOps(), DB.getLog(), getLoraMessages(), DB.getMeta<number>('lastSync', 0)]);
    setIncidents(inc);
    setOps(o);
    setLog(l);
    setLora(lr);
    setLastSync(ls);
  }, []);

  const doSync = useCallback(async () => {
    if (!onlineRef.current) return;
    setSyncing(true);
    try {
      const r = await runSync();
      if (r.synced && sessionRef.current.role !== 'ciudadano') toast(`${r.synced} cambio(s) sincronizados con la central simulada`, 'ok');
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh, toast]);

  // Inicialización
  useEffect(() => {
    (async () => {
      try {
        const seeded = await DB.ensureSeed();
        if (seeded) await DB.addLog('info', 'Datos de demostración cargados (escenario ficticio).');
        setSettings(await DB.getSettings());
        setSession(await DB.getMeta<Session>('session', CITIZEN));
        setProfile(await DB.getMeta<Profile | null>('profile', null));
        setAlerts(await DemoAlertsAdapter.fetch());
        await refresh();
      } catch (e) {
        console.error(e);
        toast('No fue posible abrir el almacenamiento local. Revise el modo privado del navegador.', 'err');
      } finally {
        setReady(true);
      }
    })();
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const unsub = radio.onUpdate(() => {
      getLoraMessages().then(setLora);
      DB.getLog().then(setLog);
    });
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
      unsub();
    };
  }, [refresh, toast]);

  // Cambio de conectividad
  const prevOnline = useRef<boolean | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (prevOnline.current !== null && prevOnline.current !== online) {
      DB.addLog('offline', online ? 'Conexión disponible' : 'Sin conexión a internet: modo offline').then(refresh);
    }
    prevOnline.current = online;
    if (online) doSync();
  }, [online, ready, doSync, refresh]);

  const loadUsgs = useCallback(async () => {
    if (!onlineRef.current) {
      setUsgs((u) => ({ ...u, status: 'offline' }));
      return;
    }
    setUsgs((u) => ({ ...u, status: 'loading' }));
    try {
      const items = await UsgsEarthquakeAdapter.fetch();
      setUsgs({ items, status: 'ok', at: Date.now() });
      await DB.setMeta('usgsCache', { items, at: Date.now() });
    } catch (e) {
      const cached = await DB.getMeta<{ items: OfficialAlert[]; at: number } | null>('usgsCache', null);
      setUsgs({ items: cached?.items ?? [], status: 'error', at: cached?.at, error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    DB.getMeta<{ items: OfficialAlert[]; at: number } | null>('usgsCache', null).then((c) => {
      if (c) setUsgs({ items: c.items, status: 'ok', at: c.at });
      if (online) loadUsgs();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const duplicatesOf = useMemo(() => {
    const m = new Map<string, Incident[]>();
    for (const i of incidents) if (i.duplicateOf) m.set(i.duplicateOf, [...(m.get(i.duplicateOf) ?? []), i]);
    return m;
  }, [incidents]);

  const assessments = useMemo(() => {
    const m = new Map<string, Assessment>();
    for (const i of incidents) m.set(i.id, assess(i, duplicatesOf.get(i.id)?.length ?? 0, now));
    return m;
  }, [incidents, duplicatesOf, now]);

  const select = useCallback(
    (id: string | null, fly = false) => {
      setSelectedId(id);
      if (id && fly) {
        const i = incidents.find((x) => x.id === id);
        if (i?.lat != null && i.lng != null) setFlyTarget({ lat: i.lat, lng: i.lng, zoom: 15, key: Date.now() });
      }
    },
    [incidents],
  );

  const flyTo = useCallback((lat: number, lng: number, zoom?: number) => setFlyTarget({ lat, lng, zoom, key: Date.now() }), []);

  /**
   * Ubicación robusta:
   *  1) verifica página segura (https) y permiso; 2) pide primero una ubicación rápida (red/wifi),
   *  3) si falla, insiste con GPS de alta precisión; 4) luego refina en segundo plano unos segundos.
   *  Un temporizador propio evita quedar esperando si el navegador nunca responde.
   */
  const watchRef = useRef<number | null>(null);
  const locate = useCallback(async (opts?: { silent?: boolean }): Promise<UserPos | null> => {
    const fail = (reason: LocationProblem) => {
      setGeoError(LOCATION_MESSAGES[reason]);
      setLocProblem(reason);
      if (reason === 'denegado' || reason === 'navegador_app') setLocPerm('denied');
      if (!opts?.silent) setSheet({ kind: 'location-help', reason });
      return null;
    };
    if (!window.isSecureContext) return fail('inseguro');
    if (!('geolocation' in navigator)) return fail('no_soportado');
    // No se corta aunque el permiso figure como bloqueado: algunos navegadores (Safari) sí vuelven a
    // preguntar, y si de verdad está bloqueado la respuesta llega al instante.
    const getPos = (o: PositionOptions, watchdogMs: number) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        const t = setTimeout(() => reject({ code: 3, message: 'sin respuesta' }), watchdogMs);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            clearTimeout(t);
            resolve(p);
          },
          (e) => {
            clearTimeout(t);
            reject(e);
          },
          o,
        );
      });
    setLocating(true);
    let p: GeolocationPosition | null = null;
    try {
      p = await getPos({ enableHighAccuracy: false, maximumAge: 120_000, timeout: 8_000 }, 10_000);
    } catch (e) {
      const code = (e as GeolocationPositionError).code;
      if (code === 1) {
        setLocating(false);
        return fail(isInAppBrowser() ? 'navegador_app' : 'denegado');
      }
      try {
        p = await getPos({ enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 }, 14_000);
      } catch (e2) {
        setLocating(false);
        return fail((e2 as GeolocationPositionError).code === 1 ? 'denegado' : 'no_disponible');
      }
    }
    setLocating(false);
    const pos: UserPos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
    setUserPos(pos);
    setGeoError(null);
    setLocProblem(null);
    setLocPerm('granted');
    // Refinar con GPS durante unos segundos si la primera lectura fue imprecisa.
    if (pos.accuracy > 50) {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      const id = navigator.geolocation.watchPosition(
        (q) => {
          if (q.coords.accuracy < pos.accuracy) {
            setUserPos({ lat: q.coords.latitude, lng: q.coords.longitude, accuracy: q.coords.accuracy, at: Date.now() });
            if (q.coords.accuracy <= 30) navigator.geolocation.clearWatch(id);
          }
        },
        () => navigator.geolocation.clearWatch(id),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
      watchRef.current = id;
      setTimeout(() => navigator.geolocation.clearWatch(id), 30_000);
    }
    return pos;
  }, []);

  // La app pide el permiso de ubicación sola al abrir (ventana nativa del navegador)
  // y sigue el estado del permiso para reaccionar si la persona lo concede después.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (!ready) return;
    let status: PermissionStatus | null = null;
    const apply = (st: PermissionState) => {
      setLocPerm(st);
      if (st === 'granted') locate({ silent: true });
    };
    (async () => {
      try {
        status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        apply(status.state);
        status.onchange = () => status && apply(status.state);
        if (status.state === 'prompt' && !autoAsked.current) {
          autoAsked.current = true;
          locate({ silent: true });
        }
      } catch {
        // Safari antiguo: sin API de permisos. Se pide directamente.
        if (!autoAsked.current) {
          autoAsked.current = true;
          const p = await locate({ silent: true });
          setLocPerm(p ? 'granted' : 'unknown');
        }
      }
    })();
    return () => {
      if (status) status.onchange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const setDraft = useCallback((d: Partial<Draft>) => setDraftState((prev) => ({ ...prev, ...d })), []);
  const resetDraft = useCallback(() => setDraftState(emptyDraft()), []);

  const findDuplicates = useCallback(
    (d: Pick<Draft, 'category' | 'lat' | 'lng'>) => {
      if (d.lat == null || d.lng == null || !d.category) return [];
      return incidents
        .filter(
          (i) =>
            !i.duplicateOf &&
            i.attention !== 'resuelto' &&
            i.lat != null &&
            i.lng != null &&
            (i.category === d.category || (['atrapada', 'estructural'].includes(i.category) && ['atrapada', 'estructural'].includes(d.category!))) &&
            haversineKm(i.lat, i.lng, d.lat!, d.lng!) < 0.35 &&
            Date.now() - i.updatedAt < 24 * 3_600_000,
        )
        .slice(0, 3);
    },
    [incidents],
  );

  const submitting = useRef(new Set<string>());
  const createIncident = useCallback(
    async (d: Draft) => {
      // Idempotencia local: el mismo borrador no puede registrarse dos veces.
      const existing = await DB.getIncident(d.draftId);
      if (existing || submitting.current.has(d.draftId)) return existing ?? (incidents.find((i) => i.id === d.draftId) as Incident);
      submitting.current.add(d.draftId);
      const now = Date.now();
      const inc: Incident = {
        id: d.draftId,
        category: d.category!,
        title: '',
        description: d.description.trim(),
        lat: d.lat,
        lng: d.lng,
        accuracyM: d.accuracyM,
        locationLabel: d.address.trim() || d.locationLabel || (d.lat != null ? `${d.lat.toFixed(5)}, ${d.lng!.toFixed(5)}` : 'Sin ubicación'),
        addressText: d.address.trim() || null,
        municipality: d.municipality || 'Sin determinar',
        locationPrecision: d.locationPrecision,
        createdAt: now,
        updatedAt: now,
        source: sessionRef.current.role === 'ciudadano' ? 'usuario' : 'organismo',
        sourceLabel:
          sessionRef.current.role === 'ciudadano'
            ? 'Reporte ciudadano desde esta app'
            : `${sessionRef.current.unitId ? UNIT[sessionRef.current.unitId]?.name : 'Central'} (demo)`,
        verification: 'sin_verificar',
        attention: 'pendiente',
        transmission: onlineRef.current ? 'pendiente' : 'local',
        affected: d.affected,
        infrastructure: d.infrastructure,
        duplicateOf: d.duplicateOf,
        confirmations: 0,
        contributions: [],
        photo: d.photo,
        version: 1,
        isDemo: false,
        mine: true,
        sensitive: d.category === 'desaparecida' || d.category === 'atrapada',
        reporterDoc: sessionRef.current.role === 'ciudadano' && profileRef.current ? { type: profileRef.current.type, number: profileRef.current.number } : null,
      };
      inc.title = CAT[inc.category].label;
      await DB.putIncident(inc);
      await enqueue(inc.id, 'create', 1, `Nuevo reporte ${inc.id} (${CAT[inc.category].short})`);
      await DB.addLog('info', `Reporte ${inc.id} guardado en este dispositivo${onlineRef.current ? '' : ' (sin conexión)'}`, inc.id);
      await refresh();
      submitting.current.delete(d.draftId);
      if (onlineRef.current) doSync();
      return inc;
    },
    [incidents, refresh, doSync],
  );

  const updateIncident = useCallback(
    async (id: string, patch: Partial<Incident>, summary: string, type: SyncOp['type'] = 'update') => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      const next: Incident = { ...cur, ...patch, version: cur.version + 1, updatedAt: Date.now() };
      if (next.transmission === 'recibido_central') next.transmission = onlineRef.current ? 'pendiente' : 'local';
      await DB.putIncident(next);
      await enqueue(id, type, next.version, summary);
      await DB.addLog('info', summary, id);
      await refresh();
      if (onlineRef.current) doSync();
    },
    [refresh, doSync],
  );

  const confirmActive = useCallback(
    async (id: string) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      // Una confirmación ciudadana aumenta la CONFIANZA, nunca convierte en "verificado oficial".
      await updateIncident(
        id,
        {
          confirmations: cur.confirmations + 1,
          lastConfirmedAt: Date.now(),
          contributions: [...cur.contributions, { at: Date.now(), text: 'Confirmó que el incidente sigue activo', kind: 'sigue_activo' }],
        },
        `Confirmación "sigue activo" en ${id}`,
        'confirm',
      );
      toast('Gracias. Tu confirmación se registró (no equivale a verificación oficial).', 'ok');
    },
    [updateIncident, toast],
  );

  const contribute = useCallback(
    async (id: string, text: string) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      await updateIncident(id, { contributions: [...cur.contributions, { at: Date.now(), text, kind: 'aporte' }] }, `Aporte de información en ${id}`, 'contribute');
      toast('Información agregada al reporte', 'ok');
    },
    [updateIncident, toast],
  );

  const setAttention = useCallback(
    async (id: string, a: Attention, by: 'ciudadano' | 'equipo') => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      const text =
        by === 'ciudadano'
          ? 'Un ciudadano informó que fue atendido (pendiente de confirmación por un organismo)'
          : `Estado de atención: ${{ pendiente: 'pendiente', asignado: 'asignado', en_atencion: 'en atención', resuelto: 'resuelto' }[a]}`;
      await updateIncident(
        id,
        {
          attention: by === 'ciudadano' && a === 'resuelto' ? cur.attention : a,
          contributions: [...cur.contributions, { at: Date.now(), text, kind: by === 'ciudadano' ? 'atendido_ciudadano' : 'estado', by: by === 'ciudadano' ? 'Ciudadano' : sessionRef.current.name }],
        },
        `${text} · ${id}`,
        'attention',
      );
      toast(by === 'ciudadano' ? 'Gracias. Un equipo confirmará la atención.' : 'Estado actualizado', 'ok');
    },
    [updateIncident, toast],
  );

  const markPendingSend = useCallback(
    async (id: string, note: string) => {
      const cur = await DB.getIncident(id);
      if (!cur || cur.transmission === 'recibido_central') return;
      await DB.putIncident({ ...cur, transmission: 'pendiente' });
      await DB.addLog('offline', note, id);
      await refresh();
    },
    [refresh],
  );

  const markSentByChannel = useCallback(
    async (id: string, channel: 'sms' | 'lora', note: string) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      if (cur.transmission === 'recibido_central') {
        await DB.putIncident({ ...cur, sentVia: Array.from(new Set([...(cur.sentVia ?? []), channel])), smsPreparedAt: channel === 'sms' ? null : cur.smsPreparedAt });
        await DB.addLog(channel, note, id);
        await refresh();
        return;
      }
      await DB.putIncident({
        ...cur,
        transmission: 'enviado_canal',
        channel,
        sentVia: Array.from(new Set([...(cur.sentVia ?? []), channel])),
        smsPreparedAt: channel === 'sms' ? null : cur.smsPreparedAt,
      });
      await DB.addLog(channel, note, id);
      await refresh();
    },
    [refresh],
  );

  const prepareSms = useCallback(
    async (id: string) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      await DB.putIncident({ ...cur, smsPreparedAt: Date.now(), transmission: cur.transmission === 'local' ? 'pendiente' : cur.transmission });
      await DB.setMeta('smsPending', id);
      await DB.addLog('sms', `Se abrió la app de mensajes para ${id}. Falta confirmar si se envió.`, id);
      await refresh();
    },
    [refresh],
  );

  const confirmSms = useCallback(
    async (id: string, sent: boolean) => {
      await DB.setMeta('smsPending', null);
      if (sent) {
        await markSentByChannel(id, 'sms', `${id}: la persona confirmó que envió el SMS. Sin confirmación de la central.`);
      } else {
        const cur = await DB.getIncident(id);
        if (cur) await DB.putIncident({ ...cur, smsPreparedAt: null });
        await refresh();
      }
    },
    [markSentByChannel, refresh],
  );

  // Al volver de la app de mensajes (o si el navegador recargó la página), retomar la pregunta pendiente.
  useEffect(() => {
    if (!ready) return;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const id = await DB.getMeta<string | null>('smsPending', null);
      if (!id) return;
      const inc = await DB.getIncident(id);
      if (!inc || !inc.smsPreparedAt || Date.now() - inc.smsPreparedAt > 6 * 3_600_000 || inc.sentVia?.includes('sms')) {
        await DB.setMeta('smsPending', null);
        return;
      }
      setSheet((cur) => (cur && cur.kind === 'sms' && cur.id === id ? cur : { kind: 'sms', id }));
    };
    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [ready]);

  // —— Envío automático por radio LoRa al nodo comunitario más cercano (simulado) ——
  const [relay, setRelay] = useState<Record<string, RelayState>>({});
  const setR = (id: string, r: RelayState) => setRelay((m) => ({ ...m, [id]: r }));
  const autoRelay = useCallback(
    async (id: string) => {
      const inc = await DB.getIncident(id);
      if (!inc || inc.sentVia?.includes('lora')) return;
      const at = inc.lat != null ? { lat: inc.lat, lng: inc.lng! } : userPos;
      setR(id, { lora: 'buscando' });
      await new Promise((r) => setTimeout(r, 1200));
      let info = radio.node();
      if (radio.status() !== 'conectado') {
        const near = at ? nearestNodes(at.lat, at.lng) : [];
        if (!near.length) {
          setR(id, { lora: 'sin_nodo' });
          await DB.addLog('lora', `${id}: no se encontró un nodo de radio cercano (simulado).`, id);
          await refresh();
          return;
        }
        setR(id, { lora: 'conectando', node: near[0].node.name, km: near[0].km });
        info = await radio.connect(near[0].node, near[0].km);
      }
      setR(id, { lora: 'enviando', node: info?.longName, km: info?.distanceKm ?? undefined });
      try {
        const level = assess(inc, 0).display;
        await radio.send(id, buildLoraPayload(inc, level));
        await markSentByChannel(id, 'lora', `${id} enviado automáticamente al ${info?.longName ?? 'nodo'} (simulado). Sin confirmación de la central.`);
        setR(id, { lora: 'entregado', node: info?.longName, km: info?.distanceKm ?? undefined });
        const off = radio.onUpdate((m) => {
          if (m.incidentId !== id || m.direction !== 'tx') return;
          if (m.status === 'ack_simulado') setR(id, { lora: 'confirmado', node: info?.longName, km: info?.distanceKm ?? undefined });
          if (m.status === 'sin_ack') setR(id, { lora: 'sin_ack', node: info?.longName, km: info?.distanceKm ?? undefined });
          if (m.status === 'ack_simulado' || m.status === 'sin_ack') off();
        });
      } catch {
        setR(id, { lora: 'error' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markSentByChannel, refresh, userPos],
  );

  const saveSettings = useCallback(async (s: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      DB.saveSettings(next);
      return next;
    });
  }, []);

  const simulateReconnect = useCallback(async () => {
    await DB.addLog('sync', 'DEMO: se simuló la recuperación de la conexión');
    const next = { ...settings, offlineDemo: false };
    setSettings(next);
    await DB.saveSettings(next);
    if (!browserOnline) {
      // Sin red real: se procesa la cola contra la central simulada igualmente (herramienta de demo).
      setSyncing(true);
      const r = await runSync();
      setSyncing(false);
      toast(sessionRef.current.role === 'ciudadano' ? 'Volvió la conexión. Tus reportes se enviaron.' : `${r.synced} cambio(s) sincronizados (central simulada)`, 'ok');
      await refresh();
    }
  }, [settings, browserOnline, refresh, toast]);

  const resetDemo = useCallback(async () => {
    await DB.resetDemo();
    await DB.addLog('info', 'Datos de demostración restaurados');
    resetDraft();
    setSelectedId(null);
    await refresh();
    toast('Datos de demostración restaurados', 'ok');
  }, [refresh, resetDraft, toast]);

  const login = useCallback(async (role: Role, unitId?: string) => {
    const s: Session =
      role === 'ciudadano'
        ? CITIZEN
        : role === 'central'
          ? { role, name: 'Operador de la central (demo)' }
          : { role, name: unitId ? UNIT[unitId].name : 'Rescatista (demo)', unitId };
    setSession(s);
    await DB.setMeta('session', s);
    await DB.addLog('info', role === 'ciudadano' ? 'Sesión de equipo cerrada' : `Acceso de demostración: ${s.name}`);
    setSelectedId(null);
    setSheet(null);
    setTab('mapa');
  }, []);
  const logout = useCallback(() => login('ciudadano'), [login]);

  const saveProfile = useCallback(async (p: Profile) => {
    setProfile(p);
    profileRef.current = p;
    await DB.setMeta('profile', p);
    await DB.addLog('info', 'Registro con documento guardado en este dispositivo');
  }, []);
  const clearProfile = useCallback(async () => {
    setProfile(null);
    profileRef.current = null;
    await DB.setMeta('profile', null);
    await DB.addLog('info', 'Registro con documento eliminado de este dispositivo');
  }, []);

  const actor = () => (sessionRef.current.role === 'central' ? 'Central' : sessionRef.current.name);

  const assignUnit = useCallback(
    async (id: string, unitId: string | null) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      const text = unitId ? `Asignado a ${UNIT[unitId].name}` : 'Asignación retirada';
      await updateIncident(
        id,
        {
          assignedTo: unitId,
          attention: unitId && cur.attention === 'pendiente' ? 'asignado' : !unitId && cur.attention === 'asignado' ? 'pendiente' : cur.attention,
          contributions: [...cur.contributions, { at: Date.now(), text, kind: 'asignacion', by: actor() }],
        },
        `${text} · ${id}`,
        'assign',
      );
      toast(text, 'ok');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateIncident, toast],
  );

  const verify = useCallback(
    async (id: string, v: Verification) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      const label = { verificado_oficial: 'Verificado por un equipo de respuesta', descartado: 'Descartado tras revisión', en_verificacion: 'En verificación', sin_verificar: 'Sin verificar' }[v];
      await updateIncident(
        id,
        {
          verification: v,
          verifiedBy: v === 'verificado_oficial' ? actor() : null,
          contributions: [...cur.contributions, { at: Date.now(), text: label, kind: 'verificacion', by: actor() }],
        },
        `${label} · ${id}`,
        'verify',
      );
      toast(label, 'ok');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateIncident, toast],
  );

  const fieldNote = useCallback(
    async (id: string, text: string) => {
      const cur = await DB.getIncident(id);
      if (!cur) return;
      await updateIncident(id, { contributions: [...cur.contributions, { at: Date.now(), text, kind: 'campo', by: actor() }] }, `Nota de campo en ${id}`, 'contribute');
      toast('Nota de campo guardada', 'ok');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateIncident, toast],
  );

  const value: Ctx = {
    profile, saveProfile, clearProfile, confirmState, askConfirm, backHandler,
    ready, session, login, logout, assignUnit, verify, fieldNote, incidents, assessments, duplicatesOf, ops, log, lora, settings, online, browserOnline, lastSync, syncing, alerts, usgs,
    tab, setTab, sheet, setSheet, selectedId, select, flyTarget, flyTo, userPos, geoError, locate, locating, locPerm, locProblem, pick, setPick,
    draft, setDraft, resetDraft, createIncident, updateIncident, confirmActive, contribute, setAttention, markPendingSend,
    markSentByChannel, prepareSms, confirmSms, relay, autoRelay, saveSettings, simulateReconnect, resetDemo, refresh, loadUsgs, findDuplicates, toast, toasts,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

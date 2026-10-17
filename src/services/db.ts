import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Incident, SyncOp, LogEntry, LoraMessage, Settings } from '../types';
import { buildSeed, SEED_VERSION } from '../data/seed';

interface NRDB extends DBSchema {
  incidents: { key: string; value: Incident; indexes: { updatedAt: number } };
  ops: { key: string; value: SyncOp; indexes: { status: string; incidentId: string } };
  log: { key: string; value: LogEntry; indexes: { at: number } };
  lora: { key: string; value: LoraMessage; indexes: { at: number } };
  meta: { key: string; value: unknown };
  /** Servidor central SIMULADO: registra operaciones aplicadas (idempotencia por opId). */
  mockCentral: { key: string; value: { opId: string; incidentId: string; version: number; receivedAt: number } };
}

let dbp: Promise<IDBPDatabase<NRDB>> | null = null;

export function db() {
  if (!dbp) {
    dbp = openDB<NRDB>('nexorescate', 2, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('incidents')) d.createObjectStore('incidents', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
        if (!d.objectStoreNames.contains('ops')) {
          const s = d.createObjectStore('ops', { keyPath: 'opId' });
          s.createIndex('status', 'status');
          s.createIndex('incidentId', 'incidentId');
        }
        if (!d.objectStoreNames.contains('log')) d.createObjectStore('log', { keyPath: 'id' }).createIndex('at', 'at');
        if (!d.objectStoreNames.contains('lora')) d.createObjectStore('lora', { keyPath: 'id' }).createIndex('at', 'at');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('mockCentral')) d.createObjectStore('mockCentral', { keyPath: 'opId' });
      },
    });
  }
  return dbp;
}

export const DEFAULT_SETTINGS: Settings = {
  smsNumber: '+57 300 000 0000',
  offlineDemo: false,
  loraAdapter: 'simulado',
  baseLayer: 'calles',
  showUsgs: false,
  opsBaseLayer: 'oscuro',
};

/** Carga inicial idempotente: solo siembra si la versión del seed cambió o la base está vacía. */
export async function ensureSeed(): Promise<boolean> {
  const d = await db();
  const v = (await d.get('meta', 'seedVersion')) as number | undefined;
  const count = await d.count('incidents');
  if (v === SEED_VERSION && count > 0) return false;
  const tx = d.transaction(['incidents', 'meta'], 'readwrite');
  const store = tx.objectStore('incidents');
  for (const inc of buildSeed()) {
    const existing = await store.get(inc.id);
    if (!existing) await store.put(inc);
  }
  await tx.objectStore('meta').put(SEED_VERSION, 'seedVersion');
  if (!(await tx.objectStore('meta').get('lastSync'))) await tx.objectStore('meta').put(Date.now() - 12 * 60_000, 'lastSync');
  await tx.done;
  return true;
}

export async function resetDemo() {
  const d = await db();
  const tx = d.transaction(['incidents', 'ops', 'log', 'lora', 'meta', 'mockCentral'], 'readwrite');
  await Promise.all([
    tx.objectStore('incidents').clear(),
    tx.objectStore('ops').clear(),
    tx.objectStore('log').clear(),
    tx.objectStore('lora').clear(),
    tx.objectStore('mockCentral').clear(),
  ]);
  await tx.objectStore('meta').delete('seedVersion');
  await tx.objectStore('meta').put(Date.now() - 12 * 60_000, 'lastSync');
  await tx.done;
  await ensureSeed();
}

export async function getAllIncidents() {
  return (await db()).getAll('incidents');
}
export async function putIncident(i: Incident) {
  await (await db()).put('incidents', i);
}
export async function getIncident(id: string) {
  return (await db()).get('incidents', id);
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const v = (await (await db()).get('meta', key)) as T | undefined;
  return v === undefined ? fallback : v;
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key);
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getMeta<Partial<Settings>>('settings', {})) };
}
export async function saveSettings(s: Settings) {
  await setMeta('settings', s);
}

export async function addLog(kind: LogEntry['kind'], text: string, incidentId?: string) {
  const e: LogEntry = { id: uid('LG'), at: Date.now(), kind, text, incidentId };
  await (await db()).put('log', e);
  return e;
}
export async function getLog(limit = 60) {
  const all = await (await db()).getAllFromIndex('log', 'at');
  return all.reverse().slice(0, limit);
}

export function uid(prefix: string) {
  const r = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${r[0].toString(36).toUpperCase().slice(0, 4)}`;
}

/** Identificador corto legible para reportes nuevos: NR-XXXXXX */
export function newIncidentId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(6));
  return 'NR-' + Array.from(r, (b) => alphabet[b % alphabet.length]).join('');
}

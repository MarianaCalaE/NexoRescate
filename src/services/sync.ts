import { db, uid, addLog, setMeta } from './db';
import type { SyncOp, OpType, Incident } from '../types';

/**
 * Interfaz de transporte hacia el servidor central. En el MVP se usa un adaptador
 * SIMULADO. Una integración real (p. ej. API propia o Ushahidi) implementaría la misma
 * interfaz enviando `op` con cabecera de idempotencia = opId.
 */
export interface CentralTransport {
  readonly name: string;
  readonly simulated: boolean;
  push(op: SyncOp, incident: Incident | undefined): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }>;
}

export const SimulatedCentral: CentralTransport = {
  name: 'Central simulada (demo)',
  simulated: true,
  async push(op) {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 300));
    const d = await db();
    const seen = await d.get('mockCentral', op.opId);
    if (seen) return { ok: true, duplicate: true }; // idempotente: no se aplica dos veces
    await d.put('mockCentral', { opId: op.opId, incidentId: op.incidentId, version: op.version, receivedAt: Date.now() });
    return { ok: true, duplicate: false };
  },
};

/** Encola una operación evitando duplicados (mismo incidente + tipo + versión pendientes). */
export async function enqueue(incidentId: string, type: OpType, version: number, summary: string) {
  const d = await db();
  const pending = await d.getAllFromIndex('ops', 'incidentId', incidentId);
  const dup = pending.find((o) => o.type === type && o.version === version && o.status !== 'sincronizado');
  if (dup) return dup;
  const op: SyncOp = {
    opId: uid('OP'),
    incidentId,
    type,
    createdAt: Date.now(),
    version,
    status: 'pendiente',
    attempts: 0,
    syncedAt: null,
    summary,
  };
  await d.put('ops', op);
  return op;
}

export async function getOps() {
  const all = await (await db()).getAll('ops');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

let running = false;
/** Procesa la cola. Solo debe llamarse cuando hay conexión (real o simulada). */
export async function runSync(transport: CentralTransport = SimulatedCentral) {
  if (running) return { synced: 0, failed: 0 };
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    const d = await db();
    const queue = (await d.getAll('ops')).filter((o) => o.status !== 'sincronizado').sort((a, b) => a.createdAt - b.createdAt);
    for (const op of queue) {
      op.status = 'enviando';
      op.attempts += 1;
      await d.put('ops', op);
      const inc = await d.get('incidents', op.incidentId);
      const res = await transport.push(op, inc);
      if (res.ok) {
        op.status = 'sincronizado';
        op.syncedAt = Date.now();
        op.lastError = null;
        synced++;
        if (inc) {
          // Solo marcamos "recibido" porque la central (simulada) respondió con ACK.
          const remaining = (await d.getAllFromIndex('ops', 'incidentId', inc.id)).filter(
            (o) => o.opId !== op.opId && o.status !== 'sincronizado',
          );
          if (remaining.length === 0) {
            inc.transmission = 'recibido_central';
            inc.channel = 'internet';
            if (inc.verification === 'sin_verificar' && inc.mine) inc.verification = 'en_verificacion';
            await d.put('incidents', inc);
          }
        }
        await addLog('sync', `${op.opId} ${res.duplicate ? 'ya existía en la central (sin duplicar)' : 'sincronizada'} · ${op.summary}`, op.incidentId);
      } else {
        op.status = 'error';
        op.lastError = res.error;
        failed++;
        await addLog('error', `${op.opId} falló: ${res.error}`, op.incidentId);
      }
      await d.put('ops', op);
    }
    if (failed === 0) await setMeta('lastSync', Date.now());
  } finally {
    running = false;
  }
  return { synced, failed };
}

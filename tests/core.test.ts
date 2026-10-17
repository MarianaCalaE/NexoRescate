import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { assess } from '../src/lib/priority';
import { buildSeed } from '../src/data/seed';
import { buildSms, buildLoraPayload, byteLength } from '../src/services/compact';

// crypto.getRandomValues existe en Node 20+
const seed = buildSeed();

describe('priorización explicable', () => {
  it('duplicados y confirmaciones NO aumentan la urgencia, solo la confianza', () => {
    const base = seed.find((i) => i.id === 'NR-1007')!;
    const a0 = assess(base, 0);
    const a1 = assess({ ...base, confirmations: 25 }, 10);
    expect(a1.urgencyScore).toBe(a0.urgencyScore);
    expect(a1.confidenceScore).toBeGreaterThan(a0.confidenceScore);
  });
  it('separa urgencia y confianza y muestra motivos', () => {
    const a = assess(seed.find((i) => i.id === 'NR-1002')!, 2);
    expect(a.urgency).toBe('alta');
    expect(a.confidence).toBe('alta');
    expect(a.reasons.length).toBeGreaterThan(0);
  });
  it('reportes con baja confianza quedan "pendiente de verificación"', () => {
    const a = assess(seed.find((i) => i.id === 'NR-1051')!, 0);
    expect(a.display).toBe('pendiente_verificacion');
  });
  it('los resueltos se muestran como atendidos', () => {
    expect(assess(seed.find((i) => i.id === 'NR-1013')!).display).toBe('atendido');
  });
});

describe('datos de demostración', () => {
  it('tiene entre 30 y 50 incidentes, duplicados y ubicaciones incompletas', () => {
    expect(seed.length).toBeGreaterThanOrEqual(30);
    expect(seed.length).toBeLessThanOrEqual(50);
    expect(seed.some((i) => i.duplicateOf)).toBe(true);
    expect(seed.some((i) => i.lat == null)).toBe(true);
    expect(new Set(seed.map((i) => i.id)).size).toBe(seed.length);
  });
});

describe('mensajes compactos', () => {
  it('SMS ≤ 160 caracteres y LoRa ≤ 228 bytes', () => {
    for (const i of seed) {
      expect(buildSms(i).length).toBeLessThanOrEqual(160);
      expect(byteLength(buildLoraPayload(i, 'alta'))).toBeLessThanOrEqual(228);
    }
  });
});

describe('persistencia y cola de sincronización', () => {
  let DB: typeof import('../src/services/db');
  let S: typeof import('../src/services/sync');
  beforeAll(async () => {
    DB = await import('../src/services/db');
    S = await import('../src/services/sync');
  });
  it('la siembra es idempotente', async () => {
    expect(await DB.ensureSeed()).toBe(true);
    expect(await DB.ensureSeed()).toBe(false);
    expect((await DB.getAllIncidents()).length).toBe(seed.length);
  });
  it('no encola dos veces la misma operación y la central no duplica al reintentar', async () => {
    const a = await S.enqueue('NR-1001', 'update', 2, 't');
    const b = await S.enqueue('NR-1001', 'update', 2, 't');
    expect(a.opId).toBe(b.opId);
    const r1 = await S.SimulatedCentral.push(a, undefined);
    const r2 = await S.SimulatedCentral.push(a, undefined);
    expect(r1).toEqual({ ok: true, duplicate: false });
    expect(r2).toEqual({ ok: true, duplicate: true });
    const res = await S.runSync();
    expect(res.failed).toBe(0);
    const ops = await S.getOps();
    expect(ops.every((o) => o.status === 'sincronizado')).toBe(true);
  });
});

describe('registro con documento', async () => {
  const { validateDoc, maskDoc } = await import('../src/lib/doc');
  it('valida cédulas y pasaportes', () => {
    expect(validateDoc('CC', '1077123456')).toBeNull();
    expect(validateDoc('CC', '12.345')).not.toBeNull();
    expect(validateDoc('CC', '123')).not.toBeNull();
    expect(validateDoc('PA', 'AB123456')).toBeNull();
    expect(maskDoc({ type: 'CC', number: '1077123456' })).toBe('CC •••• 3456');
  });
  it('el SMS incluye el documento y sigue en 160 caracteres; LoRa nunca lo incluye', () => {
    const i = { ...seed[0], reporterDoc: { type: 'CC' as const, number: '1077123456' }, description: 'x'.repeat(300) };
    const sms = buildSms(i);
    expect(sms).toContain('CC:1077123456');
    expect(sms.length).toBeLessThanOrEqual(160);
    expect(buildLoraPayload(i, 'alta')).not.toContain('1077123456');
  });
});

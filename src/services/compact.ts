import type { Incident, CategoryId } from '../types';
import type { DisplayLevel } from '../lib/priority';

export const CAT_CODE: Record<CategoryId, string> = {
  sismo: 'SIS', inundacion: 'INU', deslizamiento: 'DES', incendio: 'INC', poste: 'POS', via: 'VIA',
  desaparecida: 'DSP', atrapada: 'ATR', medica: 'MED', suministros: 'SUM', estructural: 'EST', otro: 'OTR',
};
const PRIO_CODE: Record<DisplayLevel, string> = { critica: 'C', alta: 'A', moderada: 'M', baja: 'B', atendido: 'R', pendiente_verificacion: 'V' };
const ATTN_CODE = { pendiente: 'PE', asignado: 'AS', en_atencion: 'EA', resuelto: 'RE' } as const;

function ts(ms: number) {
  return new Date(ms).toISOString().slice(5, 16).replace('T', ' ') + 'Z';
}
function loc(i: Incident) {
  return i.lat != null && i.lng != null ? `${i.lat.toFixed(5)},${i.lng.toFixed(5)}` : 'SIN-COORD';
}
function ascii(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
}

/** Mensaje SMS (≤ 160 caracteres GSM‑7 cuando es posible). */
export function buildSms(i: Incident) {
  const head = `NXR ${i.id} ${CAT_CODE[i.category]} ${loc(i)} ${ascii(i.municipality).slice(0, 18)}`;
  const aff = (i.affected ? ` AF:${i.affected}` : '') + (i.reporterDoc ? ` ${i.reporterDoc.type}:${i.reporterDoc.number}` : '');
  const room = 160 - head.length - aff.length - 1;
  const desc = ascii(i.description || i.title).slice(0, Math.max(0, room));
  return `${head}${aff} ${desc}`.trim();
}

/** Carga útil LoRa: compacta, sin fotos ni mapas. Formato pipe-separado versión 1. */
export function buildLoraPayload(i: Incident, level: DisplayLevel) {
  return [`NXR1`, i.id, CAT_CODE[i.category], loc(i), `P:${PRIO_CODE[level]}`, `E:${ATTN_CODE[i.attention]}`, `T:${ts(i.updatedAt)}`].join('|');
}

export function byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}

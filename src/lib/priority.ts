import type { Incident } from '../types';
import { CAT } from '../data/categories';

/**
 * Motor de priorización explicable basado en reglas configurables.
 * HEURÍSTICA DE DEMOSTRACIÓN: no es un sistema certificado ni una recomendación
 * clínica o de rescate. Urgencia y confianza se calculan por separado.
 * El número de duplicados o interacciones NUNCA suma urgencia.
 */
export const PRIORITY_RULES = {
  lifeRiskWeight: 40, // × riesgo para la vida de la categoría (0–1)
  humanitarianBonus: 8,
  affected: [
    { min: 100, pts: 20 },
    { min: 20, pts: 14 },
    { min: 5, pts: 9 },
    { min: 1, pts: 4 },
  ],
  infraPerItem: 4,
  infraCap: 12,
  essentialInfra: ['salud', 'agua', 'energia', 'puente'] as string[],
  essentialBonus: 4,
  /** Ventana crítica: reportes con riesgo vital sin atender suben con el tiempo. */
  lifeRiskPendingPerHour: 3,
  lifeRiskPendingCap: 10,
  /** Reportes sin riesgo vital y sin actualización pierden urgencia. */
  staleHours: 24,
  stalePenalty: -6,
  thresholds: { critica: 58, alta: 40, moderada: 22 },
  confidence: {
    source: { oficial: 45, organismo: 38, ciudadano: 15, usuario: 15 },
    verification: { verificado_oficial: 35, en_verificacion: 12, sin_verificar: 0, descartado: -60 },
    location: { gps: 10, manual: 7, aproximada: 2, desconocida: -12 },
    photo: 5,
    perConfirmation: 3,
    confirmationCap: 9,
    perDuplicate: 2,
    duplicateCap: 6,
    freshHours: 6,
    freshBonus: 5,
    oldHours: 48,
    oldPenalty: -10,
    thresholds: { alta: 60, media: 35 },
  },
};

export type UrgencyLevel = 'critica' | 'alta' | 'moderada' | 'baja' | 'atendido';
export type DisplayLevel = UrgencyLevel | 'pendiente_verificacion';
export type ConfidenceLevel = 'alta' | 'media' | 'baja';

export interface Assessment {
  urgencyScore: number;
  urgency: UrgencyLevel;
  confidenceScore: number;
  confidence: ConfidenceLevel;
  display: DisplayLevel;
  reasons: string[];
  confidenceReasons: string[];
}

/** Color (token del tema) + glifo: la prioridad nunca depende solo del color. */
export const LEVEL_META: Record<DisplayLevel, { label: string; short: string; color: string; glyph: string; soft: string; ink: string }> = {
  critica: { label: 'Crítica', short: 'Crítica', color: 'rgb(var(--crit))', glyph: '!!', soft: 'bg-crit-soft', ink: 'text-crit-ink' },
  alta: { label: 'Alta', short: 'Alta', color: 'rgb(var(--high))', glyph: '!', soft: 'bg-high-soft', ink: 'text-high-ink' },
  moderada: { label: 'Moderada', short: 'Moderada', color: 'rgb(var(--mod))', glyph: '–', soft: 'bg-warn-soft', ink: 'text-warn-ink' },
  baja: { label: 'Baja', short: 'Baja', color: 'rgb(var(--low))', glyph: '·', soft: 'bg-surface-2', ink: 'text-ink-2' },
  atendido: { label: 'Atendido', short: 'Atendido', color: 'rgb(var(--ok))', glyph: '✓', soft: 'bg-ok-soft', ink: 'text-ok-ink' },
  pendiente_verificacion: { label: 'Por verificar', short: 'Por verificar', color: 'rgb(var(--verify))', glyph: '?', soft: 'bg-verify-soft', ink: 'text-verify-ink' },
};

export function assess(inc: Incident, duplicates = 0, now = Date.now()): Assessment {
  const R = PRIORITY_RULES;
  const cat = CAT[inc.category];
  const reasons: { pts: number; text: string }[] = [];
  let u = 0;

  const life = Math.round(cat.lifeRisk * R.lifeRiskWeight);
  u += life;
  reasons.push({ pts: life, text: `Riesgo para la vida: ${cat.label.toLowerCase()}` });

  if (cat.humanitarian) {
    u += R.humanitarianBonus;
    reasons.push({ pts: R.humanitarianBonus, text: 'Necesidad médica o humanitaria' });
  }

  if (inc.affected && inc.affected > 0) {
    const tier = R.affected.find((t) => inc.affected! >= t.min);
    if (tier) {
      u += tier.pts;
      reasons.push({ pts: tier.pts, text: `${inc.affected.toLocaleString('es-CO')} persona(s) afectada(s) estimadas` });
    }
  } else {
    reasons.push({ pts: 0, text: 'Número de afectados desconocido' });
  }

  const infra = inc.infrastructure ?? [];
  if (infra.length) {
    let pts = Math.min(R.infraCap, infra.length * R.infraPerItem);
    const essential = infra.filter((i) => R.essentialInfra.includes(i));
    if (essential.length) pts += R.essentialBonus;
    u += pts;
    reasons.push({ pts, text: essential.length ? 'Impacto en servicios esenciales' : 'Impacto en infraestructura' });
  }

  const hours = (now - inc.createdAt) / 3_600_000;
  const hoursSinceUpdate = (now - inc.updatedAt) / 3_600_000;
  if (inc.attention !== 'resuelto') {
    if (cat.lifeRisk >= 0.6 && inc.attention === 'pendiente') {
      const pts = Math.min(R.lifeRiskPendingCap, Math.round(hours * R.lifeRiskPendingPerHour));
      if (pts > 0) {
        u += pts;
        reasons.push({ pts, text: `${formatHours(hours)} sin atención con riesgo vital` });
      }
    } else if (cat.lifeRisk < 0.6 && hoursSinceUpdate > R.staleHours) {
      u += R.stalePenalty;
      reasons.push({ pts: R.stalePenalty, text: 'Sin actualizaciones recientes' });
    }
  }

  // —— Confianza (separada) ——
  const C = R.confidence;
  const cr: { pts: number; text: string }[] = [];
  let c = 0;
  c += C.source[inc.source];
  cr.push({ pts: C.source[inc.source], text: sourceText(inc.source) });
  c += C.verification[inc.verification];
  if (inc.verification !== 'sin_verificar') cr.push({ pts: C.verification[inc.verification], text: verText(inc.verification) });
  else cr.push({ pts: 0, text: 'Aún sin verificación' });
  c += C.location[inc.locationPrecision];
  cr.push({ pts: C.location[inc.locationPrecision], text: locText(inc.locationPrecision) });
  if (inc.photo) {
    c += C.photo;
    cr.push({ pts: C.photo, text: 'Incluye fotografía' });
  }
  if (inc.confirmations > 0) {
    const pts = Math.min(C.confirmationCap, inc.confirmations * C.perConfirmation);
    c += pts;
    cr.push({ pts, text: `${inc.confirmations} confirmación(es) ciudadana(s) (no cambian la urgencia)` });
  }
  if (duplicates > 0) {
    const pts = Math.min(C.duplicateCap, duplicates * C.perDuplicate);
    c += pts;
    cr.push({ pts, text: `${duplicates} reporte(s) relacionado(s) agrupado(s) (no cambian la urgencia)` });
  }
  if (hoursSinceUpdate < C.freshHours) {
    c += C.freshBonus;
    cr.push({ pts: C.freshBonus, text: 'Información actualizada recientemente' });
  } else if (hoursSinceUpdate > C.oldHours) {
    c += C.oldPenalty;
    cr.push({ pts: C.oldPenalty, text: 'Información antigua' });
  }

  const urgencyScore = Math.max(0, Math.min(100, u));
  const confidenceScore = Math.max(0, Math.min(100, c));
  let urgency: UrgencyLevel =
    urgencyScore >= R.thresholds.critica
      ? 'critica'
      : urgencyScore >= R.thresholds.alta
        ? 'alta'
        : urgencyScore >= R.thresholds.moderada
          ? 'moderada'
          : 'baja';
  if (inc.attention === 'resuelto') urgency = 'atendido';
  const confidence: ConfidenceLevel =
    confidenceScore >= C.thresholds.alta ? 'alta' : confidenceScore >= C.thresholds.media ? 'media' : 'baja';

  let display: DisplayLevel = urgency;
  if (urgency !== 'atendido' && confidence === 'baja' && inc.verification !== 'verificado_oficial') display = 'pendiente_verificacion';
  if (inc.verification === 'descartado') display = 'baja';

  return {
    urgencyScore,
    urgency,
    confidenceScore,
    confidence,
    display,
    reasons: reasons
      .filter((r) => r.pts !== 0 || r.text.includes('desconocido'))
      .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
      .slice(0, 4)
      .map((r) => `${r.pts > 0 ? '+' : ''}${r.pts} · ${r.text}`),
    confidenceReasons: cr.map((r) => `${r.pts > 0 ? '+' : ''}${r.pts} · ${r.text}`),
  };
}

function formatHours(h: number) {
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(1)} h`;
}
function sourceText(s: Incident['source']) {
  return { oficial: 'Fuente oficial', organismo: 'Organismo de respuesta', ciudadano: 'Reporte ciudadano', usuario: 'Reporte ciudadano propio' }[s];
}
function verText(v: Incident['verification']) {
  return { verificado_oficial: 'Verificado oficialmente', en_verificacion: 'En proceso de verificación', sin_verificar: '', descartado: 'Descartado' }[v];
}
function locText(l: Incident['locationPrecision']) {
  return { gps: 'Ubicación GPS', manual: 'Ubicación marcada en mapa', aproximada: 'Ubicación aproximada', desconocida: 'Ubicación desconocida' }[l];
}

export const LEVEL_ORDER: DisplayLevel[] = ['critica', 'alta', 'pendiente_verificacion', 'moderada', 'baja', 'atendido'];

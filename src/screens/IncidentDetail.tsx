import { useState } from 'react';
import { MapPin, Clock, RefreshCw, Users, ShieldAlert, CheckCircle2, MessageSquare, Radio, Info, Map as MapIcon, Copy, Navigation, UserCheck, XCircle, Send, Building2 } from 'lucide-react';
import { useApp } from '../store';
import { CAT, INFRA_LABEL, SOURCE_LABEL } from '../data/categories';
import { UNITS, UNIT } from '../data/units';
import { haversineKm } from '../data/places';
import { Sheet, LevelBadge, VerifBadge, AttnBadge, TxBadge, ConfidenceBadge, CatIcon, SimTag, RestrictedTag, fmtDate, timeAgo, Btn, Section, cx, copyText } from '../components/ui';
import type { Attention, Incident } from '../types';
import { DOC_LABEL, maskDoc } from './Register';

/** Detalle completo para equipos de respuesta (rescatistas y central). */
export function IncidentDetail({ id }: { id: string }) {
  const app = useApp();
  const inc = app.incidents.find((i) => i.id === id);
  const [note, setNote] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  if (!inc) return null;
  const a = app.assessments.get(inc.id)!;
  const cat = CAT[inc.category];
  const related = app.duplicatesOf.get(inc.id) ?? [];
  const parent = inc.duplicateOf ? app.incidents.find((i) => i.id === inc.duplicateOf) : null;
  const close = () => app.setSheet(null);
  const ops = app.ops.filter((o) => o.incidentId === inc.id);
  const myUnit = app.session.unitId;
  const isCentral = app.session.role === 'central';
  const mine = !!myUnit && inc.assignedTo === myUnit;
  const unit = inc.assignedTo ? UNIT[inc.assignedTo] : null;
  const dist = app.userPos && inc.lat != null ? haversineKm(app.userPos.lat, app.userPos.lng, inc.lat, inc.lng!) : null;
  const route = inc.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${inc.lat},${inc.lng}` : null;

  return (
    <Sheet
      full
      onClose={close}
      title={
        <div className="flex items-center gap-3">
          <CatIcon id={inc.category} size={46} />
          <div className="min-w-0">
            <div className="truncate">{inc.title}</div>
            <div className="text-sm font-normal text-ink-3">
              <span className="font-data font-semibold tnum">{inc.id}</span>, {cat.label.toLowerCase()}
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        <LevelBadge level={a.display} />
        <ConfidenceBadge c={a.confidence} />
        <VerifBadge v={inc.verification} />
        <AttnBadge a={inc.attention} />
        <TxBadge inc={inc} />
        {inc.isDemo && <SimTag>Dato ficticio</SimTag>}
      </div>

      {parent && (
        <button onClick={() => app.setSheet({ kind: 'detail', id: parent.id })} className="mb-4 w-full rounded-2xl bg-verify-soft p-3 text-left text-sm text-verify-ink">
          Agrupado como reporte relacionado de <b>{parent.id}</b>. Se conserva como referencia original. Abrir el principal.
        </button>
      )}

      {/* ——— Acciones operativas ——— */}
      <div className="mb-6 rounded-3xl border border-line bg-surface-2 p-4">
        <div className="flex items-center gap-3">
          <span className={cx('grid h-11 w-11 place-items-center rounded-2xl', unit ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-3')}>
            <Building2 size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink-3">Unidad asignada</div>
            <div className="truncate font-bold">{unit ? unit.name : 'Sin asignar'}</div>
          </div>
          {dist != null && <div className="text-right font-data text-lg font-semibold tnum text-ink-2">{dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}</div>}
        </div>

        {isCentral ? (
          <select
            value={inc.assignedTo ?? ''}
            onChange={(e) => app.assignUnit(inc.id, e.target.value || null)}
            className="mt-3 h-12 w-full rounded-2xl border border-line bg-surface px-3 text-base"
            aria-label="Asignar unidad"
          >
            <option value="">Sin asignar</option>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        ) : (
          myUnit &&
          inc.attention !== 'resuelto' &&
          (mine ? (
            <Btn variant="secondary" size="sm" className="mt-3 w-full" onClick={() => app.assignUnit(inc.id, null)}>
              Liberar el caso
            </Btn>
          ) : (
            <Btn variant="act" className="mt-3 w-full" onClick={() => app.assignUnit(inc.id, myUnit)}>
              <UserCheck size={18} /> {inc.assignedTo ? 'Tomar el caso (reasignar a mi unidad)' : 'Tomar este caso'}
            </Btn>
          ))
        )}

        <div className="mt-4 text-sm font-semibold text-ink-2">Estado de atención</div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
          {(['pendiente', 'asignado', 'en_atencion', 'resuelto'] as Attention[]).map((s) => (
            <button
              key={s}
              onClick={() => app.setAttention(inc.id, s, 'equipo')}
              className={cx('min-h-[44px] rounded-xl px-1 text-sm font-semibold', inc.attention === s ? (s === 'resuelto' ? 'bg-ok text-on-ok' : 'bg-brand text-on-brand') : 'text-ink-2 hover:bg-surface-2')}
            >
              {{ pendiente: 'Pendiente', asignado: 'Asignado', en_atencion: 'En sitio', resuelto: 'Resuelto' }[s]}
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm font-semibold text-ink-2">Verificación</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn variant={inc.verification === 'verificado_oficial' ? 'ok' : 'outline'} size="sm" onClick={() => app.verify(inc.id, 'verificado_oficial')}>
            <CheckCircle2 size={16} /> Confirmado en campo
          </Btn>
          <Btn variant="outline" size="sm" onClick={() => app.verify(inc.id, inc.verification === 'descartado' ? 'en_verificacion' : 'descartado')}>
            <XCircle size={16} /> {inc.verification === 'descartado' ? 'Reabrir' : 'Descartar'}
          </Btn>
        </div>
        {inc.verifiedBy && <p className="mt-2 text-xs text-ink-3">Verificado por {inc.verifiedBy}.</p>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {route && app.online ? (
            <Btn href={route} variant="secondary" size="sm">
              <Navigation size={16} /> Ruta
            </Btn>
          ) : (
            <Btn variant="secondary" size="sm" disabled>
              <Navigation size={16} /> Ruta
            </Btn>
          )}
          <Btn variant="secondary" size="sm" onClick={() => app.setSheet({ kind: 'sms', id: inc.id })}>
            <MessageSquare size={16} /> SMS
          </Btn>
          <Btn variant="secondary" size="sm" onClick={() => app.setSheet({ kind: 'lora', id: inc.id })}>
            <Radio size={16} /> LoRa
          </Btn>
        </div>
      </div>

      {inc.restrictedNotes && (
        <Section title="Información para equipos" right={<RestrictedTag />}>
          <p className="rounded-2xl border border-verify/40 bg-verify-soft p-3 text-[15px] leading-relaxed text-verify-ink">{inc.restrictedNotes}</p>
          <p className="mt-1.5 text-xs text-ink-3">No se muestra a ciudadanos. No compartir por canales públicos.</p>
        </Section>
      )}

      {inc.reporterDoc && <ReporterDocRow doc={inc.reporterDoc} />}

      <Section title="Lo que se reporta">
        <p className="text-[15px] leading-relaxed">{inc.description || 'Sin descripción.'}</p>
        {inc.photo && <img src={inc.photo} alt="Foto adjunta al reporte" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />}
      </Section>

      <Section title="Por qué tiene esta prioridad">
        <div className="rounded-2xl border border-line p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-ink-3">Urgencia</div>
              <div className="font-display text-4xl font-bold leading-none tnum">
                {a.urgencyScore}
                <span className="text-lg text-ink-3">/100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-ink-3">Confianza</div>
              <div className="font-display text-4xl font-bold leading-none tnum">
                {a.confidenceScore}
                <span className="text-lg text-ink-3">/100</span>
              </div>
            </div>
          </div>
          <ul className="mt-3 space-y-1">
            {a.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-sm">
                <span className="w-9 shrink-0 text-right font-data font-semibold tnum text-ink-2">{r.split(' · ')[0]}</span>
                <span>{r.split(' · ').slice(1).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => setShowWhy(!showWhy)} className="mt-2 text-sm font-semibold text-brand">
            {showWhy ? 'Ocultar' : 'Ver'} factores de confianza
          </button>
          {showWhy && (
            <ul className="mt-1 space-y-1">
              {a.confidenceReasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-ink-2">
                  <span className="w-9 shrink-0 text-right font-data font-semibold tnum">{r.split(' · ')[0]}</span>
                  <span>{r.split(' · ').slice(1).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex gap-1.5 text-xs text-ink-3">
            <Info size={13} className="mt-0.5 shrink-0" /> Heurística de demostración, no certificada. Duplicados y confirmaciones solo suben la confianza.
          </p>
        </div>
      </Section>

      <Section title="Datos del reporte">
        <dl className="grid grid-cols-1 gap-1.5">
          <Row icon={MapPin} k="Ubicación" v={`${inc.locationLabel}, ${inc.municipality}`} />
          <Row
            icon={MapIcon}
            k="Coordenadas"
            v={
              inc.lat != null ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="font-data tnum">
                    {inc.lat.toFixed(5)}, {inc.lng!.toFixed(5)}
                  </span>
                  <button className="text-brand" aria-label="Copiar coordenadas" onClick={async () => app.toast((await copyText(`${inc.lat},${inc.lng}`)) ? 'Coordenadas copiadas' : 'No se pudo copiar')}>
                    <Copy size={14} />
                  </button>
                  <span className="text-xs text-ink-3">
                    {{ gps: 'GPS', manual: 'marcada en mapa', aproximada: 'aproximada', desconocida: 'desconocida' }[inc.locationPrecision]}
                    {inc.accuracyM ? `, ±${Math.round(inc.accuracyM)} m` : ''}
                  </span>
                </span>
              ) : (
                <span className="font-semibold text-verify-ink">Sin coordenadas: confirmar el lugar con quien reportó</span>
              )
            }
          />
          <Row icon={Clock} k="Reportado" v={`${fmtDate(inc.createdAt)} (${timeAgo(inc.createdAt)})`} />
          <Row icon={RefreshCw} k="Última actualización" v={`${fmtDate(inc.updatedAt)} (${timeAgo(inc.updatedAt)})`} />
          <Row icon={ShieldAlert} k="Fuente" v={`${SOURCE_LABEL[inc.source]}: ${inc.sourceLabel}`} />
          <Row icon={Users} k="Personas afectadas" v={inc.affected ? `${inc.affected.toLocaleString('es-CO')} (estimado)` : 'Desconocido'} />
          {inc.infrastructure && inc.infrastructure.length > 0 && <Row icon={ShieldAlert} k="Servicios afectados" v={inc.infrastructure.map((i) => INFRA_LABEL[i]).join(', ')} />}
          <Row icon={CheckCircle2} k="Confirmaciones ciudadanas" v={`${inc.confirmations}${inc.lastConfirmedAt ? `, la última ${timeAgo(inc.lastConfirmedAt)}` : ''}`} />
        </dl>
        {inc.lat != null && (
          <button onClick={() => { close(); app.setTab('mapa'); app.select(inc.id, true); }} className="mt-3 text-sm font-semibold text-brand">
            Ver en el mapa
          </button>
        )}
      </Section>

      {related.length > 0 && (
        <Section title={`Reportes relacionados (${related.length})`}>
          <div className="space-y-2">
            {related.map((r) => (
              <button key={r.id} onClick={() => app.setSheet({ kind: 'detail', id: r.id })} className="w-full rounded-2xl border border-line p-3 text-left text-sm">
                <div className="font-semibold">
                  <span className="font-data tnum">{r.id}</span> <span className="font-normal text-ink-3">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="text-ink-2">{r.description}</div>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Nota de campo">
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={240}
            placeholder="Qué encontraste, qué falta, riesgos…"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 text-base outline-none focus:border-brand"
          />
          <Btn
            variant="primary"
            disabled={note.trim().length < 3}
            onClick={async () => {
              await app.fieldNote(inc.id, note.trim());
              setNote('');
            }}
          >
            <Send size={18} />
          </Btn>
        </div>
      </Section>

      {(inc.contributions.length > 0 || ops.length > 0) && (
        <Section title="Bitácora">
          <ol className="space-y-2.5 border-l-2 border-line pl-3">
            {[...inc.contributions].reverse().map((c, k) => (
              <li key={k} className="text-sm">
                <div className="font-semibold">{c.text}</div>
                <div className="text-xs text-ink-3">
                  {c.by ? `${c.by}, ` : ''}
                  {fmtDate(c.at)}
                </div>
              </li>
            ))}
            {ops.slice(0, 6).map((o) => (
              <li key={o.opId} className="text-xs text-ink-3">
                Sincronización {o.type} v{o.version}: <b>{o.status}</b> <span className="font-data tnum">({o.opId})</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </Sheet>
  );
}

function Row({ icon: Icon, k, v }: { icon: typeof MapPin; k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <Icon size={17} className="mt-0.5 shrink-0 text-ink-3" />
      <div className="min-w-0">
        <dt className="text-xs text-ink-3">{k}</dt>
        <dd className="text-[15px]">{v}</dd>
      </div>
    </div>
  );
}

function ReporterDocRow({ doc }: { doc: NonNullable<Incident['reporterDoc']> }) {
  const [show, setShow] = useState(false);
  return (
    <Section title="Quién reporta" right={<RestrictedTag />}>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-verify/40 bg-verify-soft px-4 py-3 text-verify-ink">
        <div>
          <div className="text-xs">{DOC_LABEL[doc.type]}</div>
          <div className="font-data text-xl font-semibold tnum">{show ? doc.number : maskDoc(doc)}</div>
        </div>
        <button onClick={() => setShow(!show)} className="rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink">
          {show ? 'Ocultar' : 'Ver número'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-3">Dato personal (Ley 1581 de 2012). Úsalo solo para verificar o contactar por canales oficiales.</p>
    </Section>
  );
}

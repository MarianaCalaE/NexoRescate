import { useState } from 'react';
import { IdCard, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import { Sheet, Btn, cx } from '../components/ui';
import type { DocType, Profile } from '../types';

export { DOC_LABEL, validateDoc, maskDoc } from '../lib/doc';
import { DOC_LABEL, validateDoc, maskDoc } from '../lib/doc';

/**
 * Registro mínimo: solo el número de documento y la autorización de datos.
 * Se guarda en el dispositivo y se adjunta a los reportes (visible solo para equipos).
 */
export function RegisterForm({ submitLabel, onDone }: { submitLabel: string; onDone: (p: Profile) => void }) {
  const app = useApp();
  const [type, setType] = useState<DocType>(app.profile?.type ?? 'CC');
  const [number, setNumber] = useState(app.profile?.number ?? '');
  const [consent, setConsent] = useState(!!app.profile);
  const [other, setOther] = useState(app.profile ? app.profile.type !== 'CC' : false);
  const [touched, setTouched] = useState(false);
  const error = validateDoc(type, number);

  const submit = async () => {
    setTouched(true);
    if (error || !consent) return;
    const p: Profile = { type, number: number.trim().toUpperCase(), consentAt: Date.now() };
    await app.saveProfile(p);
    onDone(p);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      {other && (
        <label className="mb-3 block">
          <span className="mb-1.5 block text-base font-semibold">Tipo de documento</span>
          <select id="nr-doc-type" value={type} onChange={(e) => setType(e.target.value as DocType)} className="h-14 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base">
            {(Object.keys(DOC_LABEL) as DocType[]).map((k) => (
              <option key={k} value={k}>
                {DOC_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-base font-semibold">{type === 'CC' ? 'Número de cédula' : `Número de ${DOC_LABEL[type].toLowerCase()}`}</span>
        <input
          id="nr-doc-number"
          value={number}
          onChange={(e) => setNumber(type === 'PA' ? e.target.value.replace(/\s/g, '') : e.target.value.replace(/\D/g, ''))}
          onBlur={() => setTouched(true)}
          inputMode={type === 'PA' ? 'text' : 'numeric'}
          autoComplete="off"
          maxLength={12}
          placeholder={type === 'PA' ? 'AB123456' : '1077123456'}
          aria-invalid={touched && !!error}
          className={cx(
            'h-16 w-full rounded-2xl border-2 bg-surface px-4 font-data text-2xl font-semibold tracking-wide tnum outline-none focus:border-brand',
            touched && error ? 'border-crit' : 'border-line',
          )}
        />
      </label>
      {touched && error && <p className="mt-1.5 text-sm font-semibold text-crit-ink">{error}</p>}
      {!other && (
        <button type="button" onClick={() => setOther(true)} className="mt-2 text-sm font-semibold text-ink-3 underline">
          No tengo cédula colombiana
        </button>
      )}

      <label className={cx('mt-4 flex cursor-pointer gap-3 rounded-2xl border-2 p-3', touched && !consent ? 'border-crit' : 'border-line')}>
        <input id="nr-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[rgb(var(--brand))]" />
        <span className="text-[15px] leading-snug text-ink-2">
          Autorizo usar mi número de documento solo para atender y verificar mis reportes de emergencia (Ley 1581 de 2012).
        </span>
      </label>
      {touched && !consent && <p className="mt-1.5 text-sm font-semibold text-crit-ink">Marca la autorización para continuar.</p>}

      <Btn type="submit" className="mt-5 w-full" variant="act" size="lg">
        {submitLabel}
      </Btn>
      <p className="mt-3 flex gap-2 text-sm text-ink-3">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        Se guarda en este teléfono. Otros ciudadanos no lo ven; solo los equipos de respuesta.
      </p>
    </form>
  );
}

/** Hoja de registro desde el recordatorio o el menú. */
export function RegisterSheet() {
  const app = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => app.setSheet(null);
  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <IdCard size={22} /> {app.profile ? 'Tu registro' : 'Regístrate una sola vez'}
        </span>
      }
      subtitle={app.profile ? 'Tus reportes se envían con este documento.' : 'Para enviar reportes necesitamos tu número de documento. Ver el mapa y las alertas no lo requiere.'}
      onClose={close}
    >
      {app.profile && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-ok-soft px-4 py-3 text-ok-ink">
          <span className="font-data text-lg font-semibold tnum">{maskDoc(app.profile)}</span>
          <span className="text-sm">Registrado</span>
        </div>
      )}
      <RegisterForm
        submitLabel={app.profile ? 'Guardar cambios' : 'Guardar registro'}
        onDone={() => {
          app.toast('Registro guardado', 'ok');
          close();
        }}
      />
      {app.profile &&
        (confirmDelete ? (
          <div className="mt-4 rounded-2xl bg-crit-soft p-3 text-crit-ink">
            <p className="font-semibold">¿Borrar tu registro de este teléfono?</p>
            <p className="text-sm">Los reportes ya enviados conservan el documento. Para reportar de nuevo te lo pediremos otra vez.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Btn>
              <Btn
                variant="danger"
                onClick={async () => {
                  await app.clearProfile();
                  close();
                }}
              >
                Borrar
              </Btn>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3">
            <Trash2 size={15} /> Borrar mi registro de este teléfono
          </button>
        ))}
    </Sheet>
  );
}

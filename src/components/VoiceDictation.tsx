import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { startDictation, appendSentence, voiceSupported, VoiceError, VOICE_MESSAGES, type Dictation } from '../services/voice';
import { cx } from './ui';

/**
 * Botón grande de dictado. Un toque: empieza a escuchar. Otro toque: termina.
 * Lo dicho se va agregando al texto del reporte.
 */
export function VoiceDictation({ value, onChange, onListening }: { value: string; onChange: (v: string) => void; onListening?: (on: boolean) => void }) {
  const [state, setState] = useState<'idle' | 'preparando' | 'escuchando'>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<Dictation | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => () => handle.current?.stop(), []);
  useEffect(() => onListening?.(state === 'escuchando'), [state, onListening]);

  if (!voiceSupported()) return null;

  const stop = () => {
    handle.current?.stop();
    handle.current = null;
    setPartial('');
    setState('idle');
  };

  const start = async () => {
    setError(null);
    setState('preparando');
    setProgress(null);
    try {
      const h = await startDictation({
        onPartial: setPartial,
        onFinal: (t) => onChange(appendSentence(valueRef.current, t)),
        onProgress: setProgress,
        onEnd: () => {
          handle.current = null;
          setPartial('');
          setState('idle');
        },
      });
      handle.current = h;
      setState('escuchando');
    } catch (e) {
      setState('idle');
      setError(VOICE_MESSAGES[e instanceof VoiceError ? e.code : 'no-soportado']);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={state === 'escuchando' ? stop : state === 'idle' ? start : undefined}
        aria-pressed={state === 'escuchando'}
        className={cx(
          'flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-lg border-2 px-4 text-base font-bold transition',
          state === 'escuchando' ? 'border-crit bg-crit text-white' : 'border-brand bg-brand-soft text-ink',
        )}
      >
        {state === 'preparando' ? (
          <Loader2 size={22} className="animate-spin" />
        ) : state === 'escuchando' ? (
          <span className="relative grid h-6 w-6 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-sm bg-white/40" />
            <Square size={16} fill="currentColor" />
          </span>
        ) : (
          <Mic size={22} />
        )}
        {state === 'preparando'
          ? progress != null
            ? `Preparando el dictado… ${Math.round(progress * 100)} %`
            : 'Preparando el dictado…'
          : state === 'escuchando'
            ? 'Escuchando… toca para terminar'
            : 'Dictar con tu voz'}
      </button>
      {state === 'preparando' && progress != null && (
        <div className="mt-1.5">
          <div className="h-1.5 overflow-hidden rounded-sm bg-line">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink-3">Solo la primera vez. Después funciona sin internet.</p>
        </div>
      )}
      {state === 'escuchando' && (
        <p className="mt-1.5 min-h-[24px] text-base italic text-ink-2" aria-live="polite">
          {partial || 'Habla con calma, cerca del teléfono.'}
        </p>
      )}
      {error && <p className="mt-1.5 text-[15px] text-crit-ink">{error}</p>}
    </div>
  );
}

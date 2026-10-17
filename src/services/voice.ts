/**
 * Dictado por voz.
 *
 * Motor principal: Vosk (código abierto, Apache 2.0) compilado a WebAssembly con `vosk-browser`.
 * Reconoce la voz dentro del teléfono: el audio no sale del dispositivo y funciona sin internet
 * una vez descargado el modelo de español (~40 MB, se guarda en el teléfono la primera vez).
 *
 * Respaldo: si el modelo no se puede obtener (sin internet la primera vez), y el navegador trae
 * reconocimiento de voz propio (Web Speech API), se usa ese para no dejar a la persona sin dictado.
 */

export type VoiceEngine = 'vosk' | 'navegador';
export type VoiceErrorCode = 'sin-microfono' | 'microfono-bloqueado' | 'sin-modelo' | 'no-seguro' | 'no-soportado';

export class VoiceError extends Error {
  constructor(public code: VoiceErrorCode) {
    super(code);
  }
}

export const VOICE_MESSAGES: Record<VoiceErrorCode, string> = {
  'sin-microfono': 'No encontramos un micrófono en este teléfono.',
  'microfono-bloqueado': 'El micrófono está bloqueado. Permítelo para dictar, o escribe el mensaje.',
  'sin-modelo': 'Para dictar sin internet, primero hay que descargar el dictado con conexión. Por ahora, escribe el mensaje.',
  'no-seguro': 'El dictado solo funciona en la dirección segura (https) de la app.',
  'no-soportado': 'Este navegador no permite dictar. Escribe el mensaje.',
};

const BASE = import.meta.env.BASE_URL || '/';
/** Orden de búsqueda del modelo: variable de entorno → copia propia en /models → copia pública del proyecto vosk-browser. */
export const MODEL_URLS: string[] = [
  import.meta.env.VITE_VOSK_MODEL_URL as string | undefined,
  `${BASE}models/vosk-model-small-es.tar.gz`,
  'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-es-0.3.tar.gz',
].filter((u): u is string => !!u);

const CACHE = 'nr-voice-v1';

type VoskModel = import('vosk-browser').Model;
let modelPromise: Promise<VoskModel> | null = null;

/** ¿Hay modelo de Vosk guardado en el teléfono? (Para decir «funciona sin internet».) */
export async function voiceModelCached(): Promise<boolean> {
  try {
    if (!('caches' in window)) return false;
    const c = await caches.open(CACHE);
    for (const u of MODEL_URLS) if (await c.match(u)) return true;
  } catch {
    /* sin Cache API */
  }
  return false;
}

/** Descarga (o lee del teléfono) el archivo del modelo, informando el progreso de 0 a 1. */
async function fetchModelBlob(onProgress: (p: number | null) => void): Promise<Blob> {
  let cache: Cache | null = null;
  try {
    cache = 'caches' in window ? await caches.open(CACHE) : null;
  } catch {
    cache = null;
  }
  for (const url of MODEL_URLS) {
    const hit = cache ? await cache.match(url) : undefined;
    if (hit) return hit.blob();
  }
  for (const url of MODEL_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok || !res.body) continue;
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) continue; // Vercel devuelve index.html cuando el archivo no existe
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      onProgress(total ? 0 : null);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        onProgress(total ? Math.min(1, got / total) : null);
      }
      if (got < 1_000_000) continue; // no es un modelo
      const blob = new Blob(parts as BlobPart[], { type: 'application/gzip' });
      try {
        await cache?.put(url, new Response(blob, { headers: { 'content-type': 'application/gzip' } }));
      } catch {
        /* sin espacio: se usará igual en esta sesión */
      }
      return blob;
    } catch {
      /* probar la siguiente fuente */
    }
  }
  throw new VoiceError('sin-modelo');
}

async function loadVosk(onProgress: (p: number | null) => void): Promise<VoskModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      if (typeof WebAssembly === 'undefined') throw new VoiceError('no-soportado');
      const blob = await fetchModelBlob(onProgress);
      const Vosk = await import('vosk-browser');
      const url = URL.createObjectURL(blob);
      const model = await Vosk.createModel(url);
      return model;
    })();
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}

export interface DictationCallbacks {
  /** Texto provisional mientras la persona habla. */
  onPartial: (text: string) => void;
  /** Frase terminada: se agrega al reporte. */
  onFinal: (text: string) => void;
  /** Descarga del modelo (solo la primera vez). null = progreso desconocido. */
  onProgress?: (p: number | null) => void;
  /** El dictado se detuvo solo (silencio prolongado, error del navegador). */
  onEnd?: () => void;
}

export interface Dictation {
  engine: VoiceEngine;
  stop: () => void;
}

function webSpeechCtor(): (new () => any) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function voiceSupported() {
  return !!navigator.mediaDevices?.getUserMedia || !!webSpeechCtor();
}

async function getMic(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new VoiceError('no-seguro');
  if (!navigator.mediaDevices?.getUserMedia) throw new VoiceError('no-soportado');
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new VoiceError('sin-microfono');
    throw new VoiceError('microfono-bloqueado');
  }
}

/** Empieza a dictar. Pide el micrófono, prepara Vosk y transcribe hasta que se llame a stop(). */
export async function startDictation(cb: DictationCallbacks): Promise<Dictation> {
  // 1) Pedir el micrófono primero: así el permiso aparece apenas la persona toca el botón.
  const stream = await getMic();

  // 2) Vosk (en el teléfono). Si no hay modelo, respaldo del navegador.
  let model: VoskModel | null = null;
  try {
    model = await loadVosk(cb.onProgress ?? (() => {}));
  } catch (e) {
    const SR = webSpeechCtor();
    if (SR && navigator.onLine) {
      stream.getTracks().forEach((t) => t.stop());
      return startWebSpeech(SR, cb);
    }
    stream.getTracks().forEach((t) => t.stop());
    throw e instanceof VoiceError ? e : new VoiceError('sin-modelo');
  }

  const ctx = new AudioContext();
  const recognizer = new model.KaldiRecognizer(ctx.sampleRate);
  recognizer.on('result', (m: any) => {
    const t = (m?.result?.text || '').trim();
    if (t) cb.onFinal(t);
    cb.onPartial('');
  });
  recognizer.on('partialresult', (m: any) => cb.onPartial((m?.result?.partial || '').trim()));

  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (ev) => {
    try {
      recognizer.acceptWaveform(ev.inputBuffer);
    } catch {
      /* fragmento perdido */
    }
  };
  source.connect(node);
  node.connect(ctx.destination);

  let stopped = false;
  return {
    engine: 'vosk',
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        recognizer.retrieveFinalResult();
      } catch {
        /* nada */
      }
      setTimeout(() => {
        try {
          node.disconnect();
          source.disconnect();
          recognizer.remove();
        } catch {
          /* nada */
        }
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      }, 400);
    },
  };
}

function startWebSpeech(SR: new () => any, cb: DictationCallbacks): Dictation {
  const r = new SR();
  r.lang = 'es-CO';
  r.continuous = true;
  r.interimResults = true;
  let stopped = false;
  r.onresult = (ev: any) => {
    let partial = '';
    for (let k = ev.resultIndex; k < ev.results.length; k++) {
      const res = ev.results[k];
      if (res.isFinal) cb.onFinal(res[0].transcript.trim());
      else partial += res[0].transcript;
    }
    cb.onPartial(partial.trim());
  };
  r.onend = () => {
    if (!stopped) cb.onEnd?.();
  };
  r.start();
  return {
    engine: 'navegador',
    stop: () => {
      stopped = true;
      try {
        r.stop();
      } catch {
        /* nada */
      }
    },
  };
}

/** Une el texto dictado al que ya había, con mayúscula inicial y punto. */
export function appendSentence(prev: string, said: string, max = 280) {
  const s = said.trim();
  if (!s) return prev;
  const sentence = s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.');
  const joined = prev.trim() ? `${prev.trim()} ${sentence}` : sentence;
  return joined.slice(0, max);
}

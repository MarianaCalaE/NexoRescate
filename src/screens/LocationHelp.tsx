import { MapPinOff, RefreshCw, Smartphone } from 'lucide-react';
import { useApp, type LocationProblem } from '../store';
import { Sheet, Btn } from '../components/ui';

/** Explica por qué no se obtuvo la ubicación y cómo resolverlo, con pasos por tipo de teléfono. */
export function LocationHelpSheet({ reason }: { reason: LocationProblem }) {
  const app = useApp();
  const close = () => app.setSheet(null);
  const retry = async () => {
    close();
    const p = await app.locate();
    if (p) app.flyTo(p.lat, p.lng, 16);
  };
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const blocked = reason === 'denegado' || reason === 'navegador_app';
  const title = blocked ? 'Tu ubicación está bloqueada' : reason === 'no_disponible' ? 'No encontramos tu ubicación' : 'No podemos usar tu ubicación';

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <MapPinOff size={22} className="text-act" /> {title}
        </span>
      }
      onClose={close}
    >
      <p className="text-[17px] leading-relaxed text-ink-2">No te preocupes: escribe la dirección o toca el lugar en el mapa. Tu reporte funciona igual.</p>
      <div className="mt-5 space-y-2">
        {reason === 'no_disponible' ? (
          <>
            <Btn className="w-full" size="lg" onClick={retry}>
              <RefreshCw size={20} /> Intentar otra vez
            </Btn>
            <Btn className="w-full" variant="secondary" size="lg" onClick={close}>
              Seguir sin ubicación
            </Btn>
          </>
        ) : (
          <>
            <Btn className="w-full" size="lg" onClick={close}>
              Seguir sin ubicación
            </Btn>
            {reason !== 'inseguro' && reason !== 'no_soportado' && (
              <Btn className="w-full" variant="secondary" onClick={retry}>
                <RefreshCw size={18} /> Intentar otra vez
              </Btn>
            )}
          </>
        )}
      </div>

      {(blocked || reason === 'no_disponible') && (
        <details className="mt-5 rounded-2xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-3">Cómo activarla para la próxima vez (opcional)</summary>
          <div className="mt-2 text-[15px] leading-relaxed text-ink-2">
            {reason === 'navegador_app' ? (
              <p className="flex gap-2">
                <Smartphone size={18} className="mt-0.5 shrink-0" /> Abre el enlace en Chrome o Safari: menú ⋮ o … → «Abrir en el navegador».
              </p>
            ) : reason === 'no_disponible' ? (
              <p>Enciende la ubicación del teléfono en los ajustes rápidos y acércate a una ventana.</p>
            ) : ios ? (
              <p>Ajustes → Privacidad y seguridad → Localización → Safari → «Al usar la app».</p>
            ) : (
              <p>Toca el candado junto a la dirección de la página → Permisos → Ubicación → Permitir.</p>
            )}
            {blocked && <p className="mt-2 text-sm text-ink-3">Por seguridad, el navegador no deja que una página vuelva a preguntar después de que el permiso se bloqueó.</p>}
          </div>
        </details>
      )}
      {reason === 'inseguro' && <p className="mt-4 text-sm text-ink-3">La ubicación solo funciona desde la dirección segura (https://) de la app.</p>}
    </Sheet>
  );
}

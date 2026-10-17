import { MapPinOff, RefreshCw, Smartphone } from 'lucide-react';
import { useApp, LOCATION_MESSAGES, type LocationProblem } from '../store';
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

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <MapPinOff size={22} className="text-act" /> No pudimos usar tu ubicación
        </span>
      }
      subtitle={LOCATION_MESSAGES[reason]}
      onClose={close}
      footer={
        <div className="space-y-2">
          {reason !== 'inseguro' && reason !== 'no_soportado' && (
            <Btn className="w-full" size="lg" onClick={retry}>
              <RefreshCw size={20} /> Intentar de nuevo
            </Btn>
          )}
          <Btn className="w-full" variant="secondary" onClick={close}>
            Marcar el lugar a mano
          </Btn>
        </div>
      }
    >
      {reason === 'denegado' && (
        <ol className="list-decimal space-y-2 pl-5 text-[16px] leading-relaxed text-ink-2">
          {ios ? (
            <>
              <li>
                Abre <b>Ajustes</b> → <b>Privacidad y seguridad</b> → <b>Localización</b> y confirma que esté activada.
              </li>
              <li>
                En esa misma lista entra a <b>Safari</b> (o tu navegador) y elige <b>Al usar la app</b>. Activa <b>Ubicación exacta</b>.
              </li>
              <li>
                Vuelve aquí, toca <b>aA</b> en la barra de direcciones → <b>Configuración del sitio web</b> → <b>Ubicación: Permitir</b>.
              </li>
            </>
          ) : (
            <>
              <li>
                Toca el ícono a la izquierda de la dirección (el candado o los ajustes) → <b>Permisos</b> → <b>Ubicación</b> → <b>Permitir</b>.
              </li>
              <li>
                Revisa que la <b>Ubicación</b> del teléfono esté encendida (desliza hacia abajo desde arriba de la pantalla).
              </li>
              <li>Recarga la página y vuelve a tocar el botón de ubicación.</li>
            </>
          )}
        </ol>
      )}
      {reason === 'no_disponible' && (
        <ul className="list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-ink-2">
          <li>
            Enciende la <b>Ubicación (GPS)</b> del teléfono desde los ajustes rápidos.
          </li>
          <li>Si estás bajo techo, acércate a una ventana o sal a un lugar abierto y seguro.</li>
          <li>El primer intento puede tardar hasta un minuto. Vuelve a intentarlo.</li>
        </ul>
      )}
      {reason === 'navegador_app' && (
        <div className="flex gap-3 rounded-2xl bg-surface-2 p-4 text-[16px] text-ink-2">
          <Smartphone size={22} className="mt-0.5 shrink-0" />
          <p>
            Abriste el enlace dentro de otra app (WhatsApp, Instagram, Facebook…). Toca el menú <b>⋮</b> o <b>…</b> y elige <b>Abrir en el navegador</b> (Chrome o Safari).
          </p>
        </div>
      )}
      {reason === 'inseguro' && (
        <p className="text-[16px] text-ink-2">
          Abre la app desde su dirección segura (<b>https://</b>), por ejemplo la de Vercel. Desde una dirección <b>http://</b> el navegador no comparte la ubicación.
        </p>
      )}
      {reason === 'no_soportado' && <p className="text-[16px] text-ink-2">Prueba con Chrome o Safari actualizados.</p>}
      <p className="mt-4 text-sm text-ink-3">Mientras tanto puedes escribir la dirección o tocar el mapa: el reporte funciona igual.</p>
    </Sheet>
  );
}

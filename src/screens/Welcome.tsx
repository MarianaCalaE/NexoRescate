import { useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Hand, WifiOff, ShieldCheck, Phone } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Btn } from '../components/ui';

/**
 * Pantalla de inicio: solo el logo y una acción clara («Ingresar al portal»).
 * «Quiénes somos» queda debajo, para quien quiera saber más, sin cargar la primera vista.
 */
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const [about, setAbout] = useState(false);
  const aboutRef = useRef<HTMLElement>(null);

  const openAbout = () => {
    setAbout(true);
    requestAnimationFrame(() => aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="fixed inset-0 z-[1500] overflow-y-auto bg-paper text-ink fade-in" data-theme="citizen">
      {/* Primera vista */}
      <section className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-[calc(24px+var(--safe-b))] pt-[calc(24px+var(--safe-t))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Logo className="h-auto w-[min(72vw,300px)]" />
          <h1 className="mt-6 font-display text-[46px] font-bold leading-none tracking-tight">
            Nexo<span className="text-brand">Rescate</span>
          </h1>
          <p className="mt-3 max-w-[22rem] text-lg leading-snug text-ink-2">Reporta una emergencia en segundos, aunque no haya señal.</p>
        </div>

        <div className="space-y-3">
          <Btn size="lg" className="w-full" onClick={onEnter}>
            Ingresar al portal <ArrowRight size={22} />
          </Btn>
          <Btn size="lg" variant="outline" className="w-full" onClick={openAbout}>
            Quiénes somos <ChevronDown size={20} />
          </Btn>
          <p className="pt-1 text-center text-[15px] text-ink-3">
            Peligro inmediato:{' '}
            <a href="tel:123" className="font-bold text-ink underline">
              llama al 123
            </a>
          </p>
        </div>
      </section>

      {/* Quiénes somos */}
      {about && (
        <section ref={aboutRef} className="border-t-4 border-brand bg-surface" aria-labelledby="qs-title">
          <div className="mx-auto max-w-md px-6 pb-[calc(32px+var(--safe-b))] pt-8">
            <h2 id="qs-title" className="font-display text-[34px] font-bold leading-none">
              Quiénes somos
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
              NexoRescate es una iniciativa social que <strong className="text-ink">conecta a las personas afectadas por un desastre con quienes pueden ayudarlas</strong>: rescatistas en campo y la central
              que coordina la respuesta.
            </p>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
              Nace de algo que se repite en cada emergencia: las redes se caen y la ayuda no sabe dónde se necesita primero. Queremos que nadie se quede sin poder pedir ayuda.
            </p>

            <h3 className="mt-7 text-sm font-bold uppercase tracking-wider text-ink-3">Nuestro enfoque</h3>
            <ul className="mt-3 space-y-3">
              <Focus icon={Hand} color="bg-act text-on-act" title="Simple, para momentos de tensión">
                Sin cuenta y con un solo botón. Pocas opciones, letras grandes y pasos cortos.
              </Focus>
              <Focus icon={WifiOff} color="bg-brand text-on-brand" title="Funciona sin internet">
                El reporte se guarda en el teléfono y sale por SMS o por radio comunitaria cuando no hay datos.
              </Focus>
              <Focus icon={ShieldCheck} color="bg-ok text-on-ok" title="Lo urgente primero, con privacidad">
                Los equipos ven primero dónde hay vidas en riesgo. Tus datos solo los ven los equipos de respuesta.
              </Focus>
            </ul>

            <p className="mt-7 border-l-4 border-mod bg-warn-soft px-4 py-3 text-[15px] text-warn-ink">
              Prototipo en fase de prueba. El mapa muestra un simulacro (un sismo hipotético en el Chocó): los reportes y alertas son ficticios.
            </p>

            <Btn size="lg" className="mt-7 w-full" onClick={onEnter}>
              Ingresar al portal <ArrowRight size={22} />
            </Btn>
            <a href="tel:123" className="mt-3 flex min-h-[52px] items-center justify-center gap-2 rounded-lg border-2 border-line text-base font-bold">
              <Phone size={20} /> Llamar al 123
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

function Focus({ icon: Icon, color, title, children }: { icon: typeof Hand; color: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border border-line bg-paper p-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${color}`}>
        <Icon size={22} />
      </span>
      <div>
        <div className="text-base font-bold leading-tight">{title}</div>
        <p className="mt-0.5 text-[15px] leading-snug text-ink-2">{children}</p>
      </div>
    </li>
  );
}

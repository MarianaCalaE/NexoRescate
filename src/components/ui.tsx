import type { ReactNode } from 'react';
import { X, FlaskConical, BadgeCheck, Lock } from 'lucide-react';
import { LEVEL_META, type DisplayLevel, type ConfidenceLevel } from '../lib/priority';
import type { Incident } from '../types';
import { VERIF_LABEL, ATTN_LABEL, TX_LABEL, CAT } from '../data/categories';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function timeAgo(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'hace instantes';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `hace ${Math.floor(h / 24)} d`;
}
export function fmtDate(ms: number) {
  return new Date(ms).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5';

export function LevelBadge({ level, size = 'md' }: { level: DisplayLevel; size?: 'sm' | 'md' }) {
  const m = LEVEL_META[level];
  return (
    <span className={cx(pill, m.soft, m.ink, size === 'md' && 'px-2.5 text-sm')}>
      <span className="grid h-4 min-w-4 place-items-center rounded-full px-1 font-data text-[11px] font-bold leading-none" style={{ background: m.color, color: ['moderada', 'alta', 'atendido'].includes(level) ? '#241034' : '#fff' }}>
        {m.glyph}
      </span>
      {m.label}
    </span>
  );
}

export function ConfidenceBadge({ c }: { c: ConfidenceLevel }) {
  const map = { alta: 'bg-brand-soft text-ink', media: 'bg-surface-2 text-ink-2', baja: 'border border-dashed border-line text-ink-3' };
  return <span className={cx(pill, map[c])}>Confianza {c}</span>;
}

export function VerifBadge({ v }: { v: Incident['verification'] }) {
  const map = {
    verificado_oficial: 'bg-ok-soft text-ok-ink',
    en_verificacion: 'bg-verify-soft text-verify-ink',
    sin_verificar: 'bg-surface-2 text-ink-2',
    descartado: 'bg-surface-2 text-ink-3 line-through',
  };
  return (
    <span className={cx(pill, map[v])}>
      {v === 'verificado_oficial' && <BadgeCheck size={13} />}
      {VERIF_LABEL[v]}
    </span>
  );
}

export function AttnBadge({ a }: { a: Incident['attention'] }) {
  const map = { pendiente: 'bg-warn-soft text-warn-ink', asignado: 'bg-info-soft text-info-ink', en_atencion: 'bg-info-soft text-info-ink', resuelto: 'bg-ok-soft text-ok-ink' };
  return <span className={cx(pill, map[a])}>{ATTN_LABEL[a]}</span>;
}

export function TxBadge({ inc }: { inc: Incident }) {
  const t = inc.transmission;
  const map = { local: 'bg-ink text-paper', pendiente: 'bg-high-soft text-high-ink', enviado_canal: 'bg-info-soft text-info-ink', recibido_central: 'bg-ok-soft text-ok-ink' };
  const ch = inc.channel && t === 'enviado_canal' ? ` por ${inc.channel.toUpperCase()}` : '';
  return <span className={cx(pill, map[t])}>{TX_LABEL[t] + ch}</span>;
}

export function SimTag({ children = 'Simulado', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn-ink', className)}>
      <FlaskConical size={12} />
      {children}
    </span>
  );
}
export function RealTag({ children = 'Dato real' }: { children?: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] font-semibold text-ok-ink">{children}</span>;
}
export function RestrictedTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-verify-soft px-1.5 py-0.5 text-[11px] font-semibold text-verify-ink">
      <Lock size={11} /> Solo equipos
    </span>
  );
}

export function CatIcon({ id, size = 40, className }: { id: Incident['category']; size?: number; className?: string }) {
  const c = CAT[id];
  const Icon = c.icon;
  return (
    <span className={cx('grid shrink-0 place-items-center text-white', className)} style={{ background: c.color, width: size, height: size, borderRadius: size * 0.32 }}>
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  subtitle,
  full,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-[rgb(6_20_24/.5)] fade-in lg:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'sheet-enter flex w-full flex-col overflow-hidden rounded-t-[28px] bg-surface text-ink shadow-float lg:max-w-lg lg:rounded-[28px]',
          full ? 'h-[94dvh] lg:h-[88vh]' : 'max-h-[92dvh] lg:max-h-[88vh]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line lg:hidden" />
        <div className="flex items-start gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold leading-tight">{title}</div>
            {subtitle && <div className="mt-1 text-sm text-ink-3">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 hover:bg-surface-3" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-[calc(1rem+var(--safe-b))] pt-1">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 pb-[calc(.75rem+var(--safe-b))]">{footer}</div>}
      </div>
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'act' | 'ok' | 'outline';
export function Btn({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  type = 'button',
  href,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  href?: string;
  size?: 'md' | 'lg' | 'sm';
}) {
  const styles: Record<Variant, string> = {
    primary: 'bg-brand text-on-brand hover:brightness-110',
    secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
    outline: 'border-2 border-line bg-surface text-ink hover:bg-surface-2',
    danger: 'bg-crit text-white hover:brightness-110',
    ghost: 'bg-transparent text-brand hover:bg-surface-2',
    act: 'bg-act text-on-act hover:brightness-105',
    ok: 'bg-ok text-on-ok hover:brightness-110',
  };
  const sizes = { sm: 'min-h-[40px] px-3 text-sm rounded-xl', md: 'min-h-[52px] px-4 text-base rounded-2xl', lg: 'min-h-[64px] px-5 text-lg rounded-[20px]' };
  const cls = cx(
    'inline-flex items-center justify-center gap-2 font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40',
    sizes[size],
    styles[variant],
    className,
  );
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition',
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-2">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Diálogo de confirmación propio (los navegadores no permiten personalizar el de salida). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onAnswer,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onAnswer: (ok: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-[rgb(6_20_24/.55)] fade-in sm:items-center" onClick={() => onAnswer(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nr-confirm-title"
        className="sheet-enter w-full rounded-t-[28px] bg-surface p-5 pb-[calc(20px+var(--safe-b))] text-ink shadow-float sm:max-w-md sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nr-confirm-title" className="font-display text-[28px] font-bold leading-tight">
          {title}
        </h2>
        {body && <p className="mt-2 text-base text-ink-2">{body}</p>}
        <div className="mt-5 space-y-2">
          {/* La opción segura (quedarse) va primero y es la más visible */}
          <Btn className="w-full" size="lg" onClick={() => onAnswer(false)}>
            {cancelLabel}
          </Btn>
          <Btn className="w-full" size="lg" variant={danger ? 'outline' : 'secondary'} onClick={() => onAnswer(true)}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

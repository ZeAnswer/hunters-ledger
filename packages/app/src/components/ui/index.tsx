import { useEffect, type ReactNode } from 'react';

export function cx(...parts: (string | false | undefined | null)[]) { return parts.filter(Boolean).join(' '); }

export function Button({ children, onClick, variant = 'default', size = 'md', className, disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'success'; size?: 'sm' | 'md' | 'lg'; className?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const v = {
    default: 'bg-zinc-800 text-zinc-100 active:bg-zinc-700 border border-zinc-700',
    primary: 'bg-amber-500 text-zinc-950 font-semibold active:bg-amber-400',
    success: 'bg-emerald-600 text-white font-semibold active:bg-emerald-500',
    danger: 'bg-red-700 text-white active:bg-red-600',
    ghost: 'bg-transparent text-zinc-300 active:bg-zinc-800',
  }[variant];
  const s = { sm: 'px-2.5 py-1.5 text-sm rounded-lg', md: 'px-4 py-2.5 text-base rounded-xl', lg: 'px-5 py-3.5 text-lg rounded-2xl' }[size];
  return <button type={type} disabled={disabled} onClick={onClick} className={cx('select-none touch-manipulation disabled:opacity-40', v, s, className)}>{children}</button>;
}

export function Chip({ children, active, onClick, tone = 'neutral', className }: { children: ReactNode; active?: boolean; onClick?: () => void; tone?: 'neutral' | 'amber' | 'red' | 'green' | 'blue'; className?: string }) {
  const tones = {
    neutral: active ? 'bg-zinc-200 text-zinc-900 border-zinc-200' : 'bg-zinc-900 text-zinc-300 border-zinc-700',
    amber: active ? 'bg-amber-500 text-zinc-950 border-amber-500' : 'bg-zinc-900 text-amber-300 border-amber-800',
    red: active ? 'bg-red-600 text-white border-red-600' : 'bg-zinc-900 text-red-300 border-red-900',
    green: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-zinc-900 text-emerald-300 border-emerald-900',
    blue: active ? 'bg-sky-600 text-white border-sky-600' : 'bg-zinc-900 text-sky-300 border-sky-900',
  }[tone];
  return (
    <button type="button" onClick={onClick} className={cx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm whitespace-nowrap select-none touch-manipulation', tones, onClick ? 'active:opacity-80' : 'cursor-default', className)}>
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className={cx('w-full max-w-lg rounded-t-3xl bg-zinc-900 border-t border-zinc-700 shadow-xl flex flex-col', tall ? 'h-[92vh]' : 'max-h-[85vh]')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="text-lg font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-zinc-400 active:bg-zinc-800">✕</button>
        </div>
        <div className="overflow-y-auto px-4 pb-6 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block mb-3"><div className="mb-1 text-xs uppercase tracking-wide text-zinc-400">{label}</div>{children}</label>;
}

export const inputCls = 'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 outline-none focus:border-amber-500';

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-950">
      <button type="button" className="px-3 py-1.5 text-lg active:bg-zinc-800" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="min-w-8 text-center tabular-nums">{value}</span>
      <button type="button" className="px-3 py-1.5 text-lg active:bg-zinc-800" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function humanize(id: string) {
  return id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function signed(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

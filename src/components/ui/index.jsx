import { clsx } from 'clsx'
import { X, Loader2, AlertCircle, CheckCircle2, Info, ChevronDown, Search, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

// ── Button ─────────────────────────────────────────────────
const VARIANTS = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
  success:   'btn-success',
  outline:   'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-600 text-blue-600 text-sm font-medium hover:bg-blue-50 active:scale-[0.98] transition-all',
}
const SIZES = { xs: '!px-2.5 !py-1 !text-xs !gap-1', sm: '!px-3 !py-1.5 !text-xs', md: '', lg: '!px-5 !py-2.5 !text-base' }

export function Button({ children, variant = 'primary', size = 'md', loading, icon: Icon, className, disabled, ...p }) {
  return (
    <button disabled={disabled || loading}
      className={clsx(VARIANTS[variant], SIZES[size], (disabled || loading) && 'opacity-50 pointer-events-none', className)} {...p}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : Icon ? <Icon size={size === 'xs' ? 12 : 14} /> : null}
      {children}
    </button>
  )
}

// ── Card ────────────────────────────────────────────────────
export function Card({ children, className, noPad, ...p }) {
  return <div className={clsx('card', !noPad && 'p-5', className)} {...p}>{children}</div>
}

// ── Badge ───────────────────────────────────────────────────
const BADGE = {
  present:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
  absent:   'bg-red-100 text-red-700 border border-red-200',
  late:     'bg-amber-100 text-amber-700 border border-amber-200',
  half_day: 'bg-violet-100 text-violet-700 border border-violet-200',
  excused:  'bg-cyan-100 text-cyan-700 border border-cyan-200',
  open:     'bg-emerald-100 text-emerald-700 border border-emerald-200',
  closed:   'bg-slate-100 text-slate-600 border border-slate-200',
  pending:  'bg-amber-100 text-amber-700 border border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
  active:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
  inactive: 'bg-slate-100 text-slate-500 border border-slate-200',
  blue:     'bg-blue-100 text-blue-700 border border-blue-200',
  current:  'bg-blue-100 text-blue-700 border border-blue-200',
  withdrawn:'bg-red-100 text-red-600 border border-red-200',
  graduated:'bg-purple-100 text-purple-700 border border-purple-200',
  default:  'bg-slate-100 text-slate-600 border border-slate-200',
}
export function Badge({ children, variant = 'default', className }) {
  return (
    <span className={clsx('badge', BADGE[variant] || BADGE.default, className)}>
      {typeof children === 'string' ? children.replace(/_/g, ' ') : children}
    </span>
  )
}

// ── Input ───────────────────────────────────────────────────
export function Input({ label, error, icon: Icon, className, wrapClass, ...p }) {
  return (
    <div className={clsx('flex flex-col gap-1', wrapClass)}>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
        <input className={clsx('input-base', Icon && 'pl-9', error && '!border-red-400 !ring-red-400/20', className)} {...p} />
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

// ── Textarea ────────────────────────────────────────────────
export function Textarea({ label, error, rows = 3, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="label">{label}</label>}
      <textarea rows={rows} className={clsx('input-base resize-y', error && '!border-red-400')} {...p} />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

// ── Select ──────────────────────────────────────────────────
export function Select({ label, error, children, wrapClass, ...p }) {
  return (
    <div className={clsx('flex flex-col gap-1', wrapClass)}>
      {label && <label className="label">{label}</label>}
      <select className={clsx('input-base appearance-none cursor-pointer', error && '!border-red-400')} {...p}>{children}</select>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

// ── SearchableSelect ─────────────────────────────────────────
export function SearchableSelect({ label, options = [], value, onChange, placeholder = 'Search…', error, disabled, loading: optLoading, wrapClass }) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const ref                 = useRef(null)
  const inputRef            = useRef(null)
  const selected            = options.find(o => String(o.value) === String(value))
  const filtered            = query
    ? options.filter(o => o.label?.toLowerCase().includes(query.toLowerCase()) || o.sub?.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  return (
    <div className={clsx('flex flex-col gap-1 relative', wrapClass)} ref={ref}>
      {label && <label className="label">{label}</label>}
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={clsx('input-base text-left flex items-center justify-between gap-2',
          disabled && 'opacity-50 cursor-not-allowed',
          open && '!border-blue-500 !ring-2 !ring-blue-500/10',
          error && '!border-red-400'
        )}>
        <span className={clsx('truncate text-sm', !selected && 'text-slate-400')}>
          {optLoading ? 'Loading…' : selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={clsx('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="dropdown-menu max-h-64 flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0
              ? <div className="px-3 py-4 text-xs text-slate-400 text-center">No results found</div>
              : filtered.map(opt => (
                <div key={opt.value}
                  className={clsx('dropdown-item', String(opt.value) === String(value) && 'bg-blue-50 text-blue-700')}
                  onClick={() => { onChange(opt.value, opt); setOpen(false); setQuery('') }}>
                  {opt.avatar && (
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
                      {opt.avatar}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{opt.label}</div>
                    {opt.sub && <div className="text-xs text-slate-400 truncate">{opt.sub}</div>}
                  </div>
                  {String(opt.value) === String(value) && <Check size={13} className="text-blue-500 shrink-0" />}
                </div>
              ))
            }
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

// ── Modal ───────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520, footer }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: width, maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-display font-semibold text-[15px] text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────
export function Spinner({ size = 24, className }) {
  return <Loader2 size={size} className={clsx('animate-spin text-blue-600', className)} />
}

// ── EmptyState ───────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      {Icon && <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={22} className="text-slate-400" />
      </div>}
      <p className="text-sm font-semibold text-slate-700 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mb-5 max-w-xs leading-relaxed">{subtitle}</p>}
      {action}
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = '#2563EB', trend, loading }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">{label}</p>
          {loading
            ? <div className="shimmer h-7 w-20 rounded" />
            : <p className="font-display font-bold text-[28px] text-slate-900 leading-none">{value ?? '—'}</p>
          }
          {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
            <Icon size={18} style={{ color }} />
          </div>
        )}
      </div>
      {trend !== undefined && !loading && (
        <div className={clsx('flex items-center gap-1 mt-3 text-xs font-semibold', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
          <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
          <span className="text-slate-400 font-normal">vs last period</span>
        </div>
      )}
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full pointer-events-none" style={{ background: color + '08' }} />
    </div>
  )
}

// ── SectionHeader ────────────────────────────────────────────
export function SectionHeader({ title, sub, actions, breadcrumb }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
      <div>
        {breadcrumb && <p className="text-xs text-slate-400 mb-0.5 font-medium flex items-center gap-1.5">{breadcrumb}</p>}
        <h1 className="section-title">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// ── Table ────────────────────────────────────────────────────
export function Table({ columns, data, loading, emptyState, onRowClick }) {
  if (loading) return (
    <div className="flex flex-col gap-2 p-4">
      {[...Array(5)].map((_, i) => <div key={i} className="shimmer h-11 rounded-lg" style={{ animationDelay: `${i * 0.07}s` }} />)}
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>{columns.map(c => <th key={c.key} className="table-head-cell" style={{ textAlign: c.align || 'left' }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={columns.length}>{typeof emptyState === 'string' ? <EmptyState title={emptyState} /> : emptyState || <EmptyState title="No data found" />}</td></tr>
            : data.map((row, i) => (
              <tr key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={clsx('hover:bg-blue-50/40 transition-colors duration-75', onRowClick && 'cursor-pointer')}>
                {columns.map(c => (
                  <td key={c.key} className="table-cell" style={{ textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? <span className="text-slate-300">—</span>)}
                  </td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

// ── Alert ────────────────────────────────────────────────────
export function Alert({ type = 'info', children, onClose }) {
  const CFG = {
    info:    { cls: 'alert-info',    Icon: Info },
    success: { cls: 'alert-success', Icon: CheckCircle2 },
    warning: { cls: 'alert-warning', Icon: AlertCircle },
    danger:  { cls: 'alert-danger',  Icon: AlertCircle },
  }
  const { cls, Icon } = CFG[type] || CFG.info
  return (
    <div className={cls}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{children}</span>
      {onClose && <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>}
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={clsx('tab-btn', active === t.key ? 'active' : 'inactive')}>
          {t.icon && <t.icon size={14} />}
          {t.label}
          {t.count != null && (
            <span className={clsx('ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
              active === t.key ? 'bg-white/20' : 'bg-slate-200 text-slate-600')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── FormGrid ─────────────────────────────────────────────────
export function FormGrid({ children, cols = 2 }) {
  return (
    <div className={clsx('grid gap-4', cols === 1 && 'grid-cols-1', cols === 2 && 'grid-cols-1 sm:grid-cols-2', cols === 3 && 'grid-cols-1 sm:grid-cols-3')}>
      {children}
    </div>
  )
}

// ── Divider ──────────────────────────────────────────────────
export function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-slate-200" />
      {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</span>}
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────────────
export function Avatar({ name, size = 'md', color = '#2563EB' }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?'
  const sz = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }
  return (
    <div className={clsx('rounded-full flex items-center justify-center font-bold font-display shrink-0', sz[size])}
      style={{ background: color + '18', color }}>
      {initials}
    </div>
  )
}

// ── ConfirmModal ─────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant={variant} className="flex-1" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }>
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
    </Modal>
  )
}

// ── Step indicator (wizard) ──────────────────────────────────
export function Steps({ steps, current }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            i < current ? 'wizard-step-done' : i === current ? 'wizard-step-active' : 'wizard-step-idle')}>
            {i < current ? <Check size={13} /> : i + 1}
          </div>
          <span className={clsx('ml-2 text-sm font-medium hidden sm:block', i === current ? 'text-slate-900' : 'text-slate-400')}>
            {s}
          </span>
          {i < steps.length - 1 && <div className={clsx('mx-3 h-px w-8 sm:w-12', i < current ? 'bg-emerald-400' : 'bg-slate-200')} />}
        </div>
      ))}
    </div>
  )
}

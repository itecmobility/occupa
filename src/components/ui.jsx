import { forwardRef } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Popover from '@radix-ui/react-popover'
import * as Slider from '@radix-ui/react-slider'
import * as SwitchP from '@radix-ui/react-switch'
import { Minus, Plus, Pipette, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...a) => twMerge(clsx(a))

const variants = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm',
  outline: 'border border-line-strong bg-surface text-fg hover:bg-sunken',
  ghost: 'text-fg-2 hover:bg-sunken hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90 dark:text-[#2a0905]',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
}
export const Button = forwardRef(function Button({ variant = 'outline', size = 'md', className, ...p }, ref) {
  return (
    <button ref={ref}
      className={cn('inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background,color,box-shadow,transform] active:scale-[.98] disabled:pointer-events-none disabled:opacity-40',
        size === 'md' && 'h-9 px-3.5 text-sm', size === 'sm' && 'h-8 px-2.5 text-[13px]', size === 'icon' && 'h-9 w-9',
        variants[variant], className)}
      {...p} />
  )
})

export function Kbd({ children, className }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 px-1 font-sans text-[11px] font-medium opacity-70', className)}>{children}</kbd>
}

export function Tip({ label, kbd, side = 'bottom', children }) {
  return (
    <Tooltip.Root delayDuration={350}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={8}
          className="z-50 flex items-center gap-2 rounded-md bg-[#0b1730] px-2.5 py-1.5 text-[12.5px] font-medium text-white shadow-lg data-[state=delayed-open]:animate-in dark:bg-[#e6ecf7] dark:text-[#0b1730]"
          style={{ animation: 'tipIn .12s ease-out' }}>
          {label}{kbd && <Kbd className="border-white/30 dark:border-black/20">{kbd}</Kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Field({ label, children, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-[13px] font-medium text-fg-2">{label}</span>
      {children}
    </div>
  )
}

export function ColorField({ value, onChange, swatches, id }) {
  return (
    <div className="flex items-center gap-1.5">
      {swatches.map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-label={`Couleur ${c}`}
          className={cn('grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110', value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-accent' : 'ring-1 ring-black/10 dark:ring-white/15')}
          style={{ background: c }}>
          {value.toLowerCase() === c.toLowerCase() && <Check size={14} strokeWidth={3} className="text-white mix-blend-difference" />}
        </button>
      ))}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button aria-label="Couleur personnalisée"
            className={cn('ml-1 grid size-7 place-items-center rounded-full border border-dashed border-line-strong text-muted transition hover:border-accent hover:text-accent',
              !swatches.some((c) => c.toLowerCase() === value.toLowerCase()) && 'border-solid ring-2 ring-accent ring-offset-2 ring-offset-surface')}
            style={!swatches.some((c) => c.toLowerCase() === value.toLowerCase()) ? { background: value, color: '#fff' } : undefined}>
            <Pipette size={13} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} align="end" className="z-50 flex w-56 flex-col gap-3 rounded-xl border border-line bg-raised p-3 text-fg shadow-float">
            <span className="text-[13px] font-medium text-fg-2">Couleur personnalisée</span>
            <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-24 w-full cursor-pointer rounded-lg border border-line bg-transparent p-1" />
            <span className="text-xs uppercase text-muted">{value}</span>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

export function SizeField({ value, onChange, min, max, step = 1, id, unit, onStep }) {
  const stepFn = onStep || ((dir) => onChange(Math.max(min, Math.min(max, value + dir * step))))
  return (
    <div className="flex items-center gap-3">
      <Slider.Root className="relative flex h-5 flex-1 touch-none select-none items-center" value={[value]} min={min} max={max} step={1}
        onValueChange={([v]) => onChange(v)}>
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line">
          <Slider.Range className="absolute h-full rounded-full bg-primary" />
        </Slider.Track>
        <Slider.Thumb className="block size-4 rounded-full border-2 border-primary bg-surface shadow transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-accent-soft focus-visible:outline-none" aria-label="Taille" />
      </Slider.Root>
      <div className="flex h-8 items-center rounded-lg border border-line-strong bg-surface">
        <button onClick={() => stepFn(-1)} className="grid h-full w-7 place-items-center text-muted hover:text-fg" aria-label="Moins"><Minus size={13} /></button>
        <input id={id} type="number" value={value} min={min} max={max}
          onChange={(e) => { const v = +e.target.value; if (v >= min) onChange(Math.min(max, v)) }}
          className="h-full w-9 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <button onClick={() => stepFn(1)} className="grid h-full w-7 place-items-center text-muted hover:text-fg" aria-label="Plus"><Plus size={13} /></button>
      </div>
    </div>
  )
}

export function Toggle({ on, onClick, icon: Icon, children, id, title }) {
  return (
    <button id={id} onClick={onClick} title={title} aria-pressed={on}
      className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition',
        on ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface text-fg-2 hover:border-fg-2/40 hover:text-fg')}>
      {Icon && <Icon size={15} />}{children}
    </button>
  )
}

export function Switch({ checked, onCheckedChange, id, label }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-center justify-between gap-3 text-[13px] text-fg-2">
      {label}
      <SwitchP.Root id={id} checked={checked} onCheckedChange={onCheckedChange}
        className="relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition data-[state=checked]:bg-accent">
        <SwitchP.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[18px]" />
      </SwitchP.Root>
    </label>
  )
}

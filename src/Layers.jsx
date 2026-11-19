import { motion } from 'motion/react'
import { Eye, EyeOff, Lock, LockOpen, ChevronUp, ChevronDown, Eraser, Square, X, Type } from 'lucide-react'
import { useStore, LAYERS, layersOf } from './store'
import { cn } from './components/ui'

const ICON = { strokes: Eraser, shapes: Square, marks: X, texts: Type }

export default function Layers() {
  const plan = useStore((s) => s.plan())
  const toggle = useStore((s) => s.toggleLayer), moveL = useStore((s) => s.moveLayer)
  if (!plan) return null
  const l = layersOf(plan)
  const top = [...l.order].reverse()   // affiché du haut (premier plan) vers le bas
  const iconBtn = 'grid size-8 shrink-0 place-items-center rounded-md text-muted transition hover:bg-sunken hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold">Calques</h3>
        <span className="text-xs text-muted">du premier plan au fond</span>
      </div>
      <ul className="flex flex-col gap-1">
        {top.map((key, i) => {
          const meta = LAYERS.find((x) => x.key === key), Icon = ICON[key]
          const hidden = !!l.hidden[key], locked = !!l.locked[key], n = (plan[key] || []).length
          return (
            <motion.li layout key={key} title={meta.label} transition={{ type: 'spring', stiffness: 600, damping: 40 }} id={`layer-${key}`}
              className={cn('flex items-center gap-1 rounded-lg border border-line bg-surface py-1 pl-2.5 pr-1', hidden && 'opacity-55')}>
              <Icon size={15} strokeWidth={key === 'marks' ? 2.6 : 2} className="shrink-0 text-fg-2" />
              <span className="ml-1.5 min-w-0 flex-1 truncate text-[13px] font-medium">{meta.short}</span>
              <span className="mr-1 min-w-5 text-right text-xs tabular-nums text-muted">{n}</span>
              <button className={iconBtn} onClick={() => moveL(key, +1)} disabled={i === 0} aria-label="Monter le calque" title="Monter (passer devant)"><ChevronUp size={16} /></button>
              <button className={iconBtn} onClick={() => moveL(key, -1)} disabled={i === top.length - 1} aria-label="Descendre le calque" title="Descendre (passer derrière)"><ChevronDown size={16} /></button>
              <button className={cn(iconBtn, hidden && 'text-fg')} onClick={() => toggle(key, 'hidden')} aria-pressed={hidden} aria-label={hidden ? 'Afficher le calque' : 'Masquer le calque'} title={hidden ? 'Afficher' : 'Masquer (n\'apparaît pas non plus sur l\'image enregistrée)'}>
                {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button className={cn(iconBtn, locked && 'text-accent')} onClick={() => toggle(key, 'locked')} aria-pressed={locked} aria-label={locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'} title={locked ? 'Déverrouiller' : 'Verrouiller (plus de sélection ni de modification)'}>
                {locked ? <Lock size={15} /> : <LockOpen size={15} />}
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

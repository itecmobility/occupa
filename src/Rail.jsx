import { motion } from 'motion/react'
import { X, Type, Square, Spline, MousePointer2, Undo2 } from 'lucide-react'
import { useStore } from './store'
import { Tip, cn } from './components/ui'

export const TOOLS = [
  { id: 'mark', dom: 'tMark', icon: X, label: 'Marquer', tip: 'Marquer une place occupée', kbd: 'X' },
  { id: 'text', dom: 'tText', icon: Type, label: 'Texte', tip: 'Placer un texte', kbd: 'T' },
  { id: 'rect', dom: 'tRect', icon: Square, label: 'Rectangle', tip: 'Entourer des places', kbd: 'R' },
  { id: 'path', dom: 'tPath', icon: Spline, label: 'Circuit', tip: 'Dessiner un circuit', kbd: 'C' },
  { id: 'move', dom: 'tMove', icon: MousePointer2, label: 'Déplacer', tip: 'Sélectionner et déplacer', kbd: 'D' },
]

export default function Rail() {
  const mode = useStore((s) => s.mode), setMode = useStore((s) => s.setMode)
  const canUndo = useStore((s) => s.history.length > 0)
  return (
    <nav aria-label="Outils" className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
      {TOOLS.map((t) => {
        const on = mode === t.id
        return (
          <Tip key={t.id} label={t.tip} kbd={t.kbd} side="right">
            <button id={t.dom} onClick={() => setMode(t.id)} aria-pressed={on}
              className={cn('relative flex h-[58px] w-[62px] flex-col items-center justify-center gap-1 rounded-xl text-[11.5px] font-medium transition-colors',
                on ? 'text-primary-fg' : 'text-fg-2 hover:bg-sunken hover:text-fg')}>
              {on && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-xl bg-primary shadow-sm" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <t.icon size={20} strokeWidth={t.id === 'mark' ? 2.6 : 2} className="relative" />
              <span className="relative">{t.label}</span>
            </button>
          </Tip>
        )
      })}
      <div className="my-2 h-px w-10 bg-line" />
      <Tip label="Annuler" kbd="Ctrl Z" side="right">
        <button id="undo" onClick={() => useStore.getState().undo()} disabled={!canUndo}
          className="flex h-[58px] w-[62px] flex-col items-center justify-center gap-1 rounded-xl text-[11.5px] font-medium text-fg-2 transition hover:bg-sunken hover:text-fg disabled:opacity-35">
          <Undo2 size={20} />Annuler
        </button>
      </Tip>
    </nav>
  )
}

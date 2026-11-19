import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { Undo2, SlidersHorizontal, Check, X as XIcon } from 'lucide-react'
import { useStore } from './store'
import { TOOLS } from './Rail'
import Panel from './Panel'
import { cn } from './components/ui'

/* barre d'outils en bas de l'écran (tablette portrait / téléphone) */
export function BottomBar() {
  const mode = useStore((s) => s.mode), setMode = useStore((s) => s.setMode)
  const canUndo = useStore((s) => s.history.length > 0)
  const sheetOpen = useStore((s) => s.sheetOpen)
  const btn = 'relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium tracking-tight transition-colors sm:text-[11px]'
  return (
    <nav aria-label="Outils" className="z-20 shrink-0 border-t border-line bg-surface/95 px-1.5 pt-1.5 backdrop-blur pb-[max(6px,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-xl items-stretch gap-0.5">
        {TOOLS.map((t) => {
          const on = mode === t.id
          return (
            <button key={t.id} id={t.dom} onClick={() => setMode(t.id)} aria-pressed={on} className={cn(btn, on ? 'text-primary-fg' : 'text-fg-2 active:bg-sunken')}>
              {on && <motion.span layoutId="bottom-active" className="absolute inset-0.5 rounded-xl bg-primary" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <t.icon size={21} strokeWidth={t.id === 'mark' ? 2.6 : 2} className="relative" />
              <span className="relative truncate max-[420px]:hidden">{t.label}</span>
            </button>
          )
        })}
        <div className="my-2 w-px shrink-0 bg-line" />
        <button id="undo" onClick={() => useStore.getState().undo()} disabled={!canUndo} aria-label="Annuler" className={cn(btn, 'max-w-14 text-fg-2 active:bg-sunken disabled:opacity-35')}>
          <Undo2 size={21} /><span className="max-[420px]:hidden">Annuler</span>
        </button>
        <button id="openSheet" onClick={() => useStore.setState({ sheetOpen: !sheetOpen })} aria-expanded={sheetOpen} className={cn(btn, 'max-w-16', sheetOpen ? 'text-accent' : 'text-fg-2 active:bg-sunken')}>
          <SlidersHorizontal size={21} /><span className="max-[420px]:hidden">Réglages</span>
        </button>
      </div>
    </nav>
  )
}

/* panneau de réglages en feuille glissante */
export function SettingsSheet() {
  const open = useStore((s) => s.sheetOpen)
  const controls = useDragControls()
  const close = () => useStore.setState({ sheetOpen: false })
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" className="absolute inset-0 z-30 bg-[#050b17]/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div key="sheet" role="dialog" aria-label="Réglages"
            className="absolute inset-x-0 bottom-0 z-40 mx-auto flex max-h-[78%] max-w-xl flex-col rounded-t-2xl border border-b-0 border-line bg-surface shadow-float"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y" dragListener={false} dragControls={controls} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 90 || i.velocity.y > 500) close() }}>
            <div className="flex shrink-0 cursor-grab touch-none items-center justify-between px-5 pb-1 pt-2" onPointerDown={(e) => controls.start(e)}>
              <span className="w-8" />
              <span className="h-1.5 w-10 rounded-full bg-line-strong" />
              <button onClick={close} aria-label="Fermer" className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken"><XIcon size={18} /></button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain"><Panel variant="sheet" /></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* compteur flottant (remplace la carte « P » du panneau sur petit écran) */
export function FloatingCounter() {
  const n = useStore((s) => s.plan()?.marks.length ?? 0)
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 rounded-xl bg-sign py-1.5 pl-2 pr-3 text-white shadow-float shadow-[inset_0_0_0_2px_var(--sign),inset_0_0_0_3.5px_rgba(255,255,255,.95)]">
      <span className="grid size-7 place-items-center text-[22px] font-bold leading-none">P</span>
      <div className="relative h-7 min-w-[2ch] overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={n} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="block text-[24px] font-bold leading-7">{n}</motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[11px] leading-tight text-white/80">occupée{n > 1 ? 's' : ''}</span>
    </div>
  )
}

/* bouton « Terminer le circuit » pendant le tracé */
export function FinishPathChip() {
  const drafting = useStore((s) => !!s.draftPathId)
  return (
    <AnimatePresence>
      {drafting && (
        <motion.button initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
          onClick={() => useStore.getState().finishPath()}
          className="pointer-events-auto flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg shadow-float">
          <Check size={17} />Terminer le circuit
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export function useMedia(q) {
  const [v, set] = useState(() => window.matchMedia(q).matches)
  useEffect(() => { const m = window.matchMedia(q); const on = () => set(m.matches); m.addEventListener('change', on); on(); return () => m.removeEventListener('change', on) }, [q])
  return v
}

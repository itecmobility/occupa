import { useEffect } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'
import { motion } from 'motion/react'
import { Minus, Plus, Maximize, ImagePlus } from 'lucide-react'
import { useStore } from './store'
import TopBar from './TopBar'
import Rail from './Rail'
import Panel from './Panel'
import CanvasView, { canvasApi } from './CanvasView'
import { DialogHost, isDialogOpen } from './dialogs'
import { save, stepTextSize } from './actions'
import { Button, Tip } from './components/ui'
import { BottomBar, SettingsSheet, FloatingCounter, FinishPathChip, useMedia } from './Mobile'

function ZoomBar() {
  const zoom = useStore((s) => s.zoom), setZoom = useStore((s) => s.setZoom)
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-line bg-raised p-1 shadow-float">
      <Tip label="Dézoomer" side="top"><button id="zOut" onClick={() => canvasApi.zoomAt?.(zoom / 1.2)} className="grid size-8 place-items-center rounded-lg text-fg-2 hover:bg-sunken hover:text-fg"><Minus size={16} /></button></Tip>
      <button onClick={() => canvasApi.zoomAt?.(1)} title="Taille réelle" className="h-8 min-w-14 rounded-lg px-2 text-[13px] font-semibold text-fg-2 hover:bg-sunken">{Math.round(zoom * 100)} %</button>
      <Tip label="Zoomer" side="top"><button id="zIn" onClick={() => canvasApi.zoomAt?.(zoom * 1.2)} className="grid size-8 place-items-center rounded-lg text-fg-2 hover:bg-sunken hover:text-fg"><Plus size={16} /></button></Tip>
      <div className="mx-0.5 h-5 w-px bg-line" />
      <Tip label="Ajuster à l'écran" side="top"><button id="zFit" onClick={() => canvasApi.fit?.()} className="grid size-8 place-items-center rounded-lg text-fg-2 hover:bg-sunken hover:text-fg"><Maximize size={15} /></button></Tip>
    </div>
  )
}

function Empty() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-surface text-muted shadow-float"><ImagePlus size={26} /></div>
        <h2 className="text-lg font-semibold">Aucun plan pour l'instant</h2>
        <p className="text-sm text-muted">Ajoutez l'image d'un plan de parking pour commencer le relevé.</p>
        <Button variant="primary" className="mt-1" onClick={() => document.getElementById('file').click()}>Ajouter un plan</Button>
      </motion.div>
    </div>
  )
}

export default function App() {
  const ready = useStore((s) => s.ready), hasPlan = useStore((s) => !!s.plan())
  const theme = useStore((s) => s.theme)
  const desktop = useMedia('(min-width: 1024px)')
  useEffect(() => { if (desktop) useStore.setState({ sheetOpen: false }) }, [desktop])

  useEffect(() => { useStore.getState().init() }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (isDialogOpen()) return
      const s = useStore.getState()
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); save(); return }
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); s.undo(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (s.draftPathId && (k === 'enter' || k === 'escape')) { s.finishPath(); return }
      const map = { x: 'mark', t: 'text', r: 'rect', l: 'line', c: 'path', e: 'erase', d: 'move' }
      if (map[k]) { s.setMode(map[k]); if (k === 't') setTimeout(() => document.getElementById('txt')?.focus(), 50); return }
      if (s.selected?.kind === 't' && (k === '+' || k === '=')) return stepTextSize(1)
      if (s.selected?.kind === 't' && (k === '-' || k === '_')) return stepTextSize(-1)
      if ((k === 'delete' || k === 'backspace') && s.selected) { s.removeItem(s.selected.kind, s.selected.id); return }
      if (k === 'escape') s.select(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Tooltip.Provider>
      <div className="flex h-full flex-col">
        <TopBar compact={!desktop} />
        <div className="flex min-h-0 flex-1">
          {desktop && <Rail />}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <CanvasView />
            {ready && !hasPlan && <Empty />}
            {hasPlan && !desktop && <FloatingCounter />}
            {hasPlan && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 sm:bottom-4">
                <FinishPathChip />
                <ZoomBar />
              </div>
            )}
            {!desktop && <SettingsSheet />}
          </div>
          {desktop && <Panel />}
        </div>
        {!desktop && <BottomBar />}
      </div>
      <DialogHost />
      <Toaster theme={theme} position="bottom-center" offset={desktop ? 76 : 150} toastOptions={{ style: { fontFamily: 'var(--font-sans)', background: 'var(--raised)', color: 'var(--fg)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-float)' } }} />
    </Tooltip.Provider>
  )
}

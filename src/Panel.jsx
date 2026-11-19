import { AnimatePresence, motion } from 'motion/react'
import { Bold, Highlighter, SquareDashed, PaintBucket, MoveRight, X, Square, Trash2, MousePointerClick } from 'lucide-react'
import { useStore } from './store'
import { Button, ColorField, SizeField, Toggle, Switch, Field, Kbd } from './components/ui'
import { PSign } from './TopBar'
import { clearMarks, clearShapes, clearAll, stepTextSize } from './actions'

const CTX = {
  mark: ['Marquer', 'Cliquez une place pour la marquer occupée. Cliquez un X pour l\'enlever.'],
  markSel: ['X sélectionné', 'Glissez pour le déplacer, Suppr pour le retirer.'],
  text: ['Texte', 'Tapez le texte, puis cliquez sur le plan pour le placer.'],
  textSel: ['Texte sélectionné', 'Les réglages s\'appliquent à ce texte. Tirez la poignée du coin pour la taille, double-cliquez pour le réécrire.'],
  rect: ['Rectangle', 'Glissez sur le plan pour entourer des places.'],
  rectSel: ['Rectangle sélectionné', 'Les réglages s\'appliquent à ce rectangle. Tirez les poignées pour l\'agrandir ou le réduire, glissez-le en mode Déplacer, Suppr pour le retirer.'],
  path: ['Circuit', 'Cliquez chaque point. Un nouveau circuit s\'accroche aux points existants. Double-clic, Entrée ou clic droit pour terminer.'],
  pathSel: ['Circuit sélectionné', 'Les réglages s\'appliquent à ce circuit. Glissez pour le déplacer, Suppr pour le retirer.'],
  move: ['Déplacer', 'Cliquez un X, un texte, un rectangle ou un circuit pour le sélectionner et le modifier.'],
}
const SW_X = ['#e00000', '#0f1f3d', '#f08c00', '#16a34a']
const SW_T = ['#0f1f3d', '#2f62e8', '#e00000', '#000000']
const SW_D = ['#16a34a', '#2f62e8', '#f08c00', '#e00000']

function Counter() {
  const n = useStore((s) => s.plan()?.marks.length ?? 0)
  return (
    <div className="m-4 flex items-center gap-4 rounded-2xl bg-sign p-4 text-white shadow-[inset_0_0_0_3px_var(--sign),inset_0_0_0_5px_rgba(255,255,255,.95)]">
      <span className="grid size-12 place-items-center text-[40px] font-bold leading-none">P</span>
      <span className="text-[13px] leading-tight text-white/80">places<br />occupées</span>
      <div className="relative ml-auto h-12 min-w-[2.5ch] overflow-hidden text-right">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={n} id="count" initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -26, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }} className="block text-[44px] font-bold leading-[48px] tracking-tight">{n}</motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Panel() {
  const s = useStore()
  const sel = s.selected, item = s.selectedItem()
  const k = sel ? (sel.kind === 't' ? 'text' : sel.kind === 'm' ? 'mark' : item?.type || 'move') : s.draftPathId ? 'path' : s.mode
  const key = k + (sel ? 'Sel' : '')
  const [title, hint] = CTX[key] || CTX[k]
  const snapIfSel = () => { if (useStore.getState().selected) useStore.getState().snapshot() }
  const { xStyle: x, tStyle: t, dStyle: d, setStyle } = s

  return (
    <aside aria-label="Réglages" className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <Counter />

      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={key + (item?.id || '')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}
          className="flex flex-col gap-5 px-5 pb-6 pt-1">
          <div>
            <h2 id="ctxTitle" className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{hint}</p>
          </div>

          {k === 'mark' && (
            <>
              <Field label="Couleur"><ColorField id="xColor" value={x.color} swatches={SW_X} onChange={(c) => setStyle('xStyle', { color: c })} /></Field>
              <Field label="Taille"><div onPointerDownCapture={snapIfSel}><SizeField id="xSize" value={x.size} min={6} max={120} onChange={(v) => setStyle('xStyle', { size: v })} /></div></Field>
              <Field label="Épaisseur"><div onPointerDownCapture={snapIfSel}><SizeField id="xWidth" value={x.width} min={1} max={20} onChange={(v) => setStyle('xStyle', { width: v })} /></div></Field>
            </>
          )}

          {k === 'text' && (
            <>
              {!sel && (
                <Field label="Texte à placer">
                  <input id="txt" value={s.textValue} onChange={(e) => useStore.setState({ textValue: e.target.value })} placeholder="Ex. : 12 places libres"
                    className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent-soft" />
                </Field>
              )}
              <Field label="Couleur"><ColorField id="tColor" value={t.color} swatches={SW_T} onChange={(c) => setStyle('tStyle', { color: c })} /></Field>
              <Field label="Taille">
                <div onPointerDownCapture={(e) => { if (!e.target.closest('button')) snapIfSel() }}>
                  <SizeField id="tSize" value={t.size} min={8} max={200} onChange={(v) => setStyle('tStyle', { size: v })} onStep={stepTextSize} />
                </div>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Toggle id="tBold" icon={Bold} on={t.bold} onClick={() => { snapIfSel(); setStyle('tStyle', { bold: !t.bold }) }}>Gras</Toggle>
                <Toggle id="tBg" icon={Highlighter} on={t.bg} onClick={() => { snapIfSel(); setStyle('tStyle', { bg: !t.bg }) }}>Fond blanc</Toggle>
              </div>
            </>
          )}

          {(k === 'rect' || k === 'path') && (
            <>
              <Field label="Couleur"><ColorField id="dColor" value={d.color} swatches={SW_D} onChange={(c) => setStyle('dStyle', { color: c })} /></Field>
              <Field label="Épaisseur du trait"><div onPointerDownCapture={snapIfSel}><SizeField id="dWidth" value={d.width} min={1} max={40} onChange={(v) => setStyle('dStyle', { width: v })} /></div></Field>
              {k === 'path' && <Field label="Taille des nœuds"><div onPointerDownCapture={snapIfSel}><SizeField id="dNode" value={d.node} min={0} max={60} onChange={(v) => setStyle('dStyle', { node: v })} /></div></Field>}
              <div className="flex flex-wrap gap-2">
                <Toggle id="dDash" icon={SquareDashed} on={d.dash} onClick={() => { snapIfSel(); setStyle('dStyle', { dash: !d.dash }) }}>Pointillés</Toggle>
                {k === 'rect' && <Toggle id="dFill" icon={PaintBucket} on={d.fill} onClick={() => { snapIfSel(); setStyle('dStyle', { fill: !d.fill }) }}>Remplissage</Toggle>}
                {k === 'path' && <Toggle id="dArrow" icon={MoveRight} on={d.arrow} onClick={() => { snapIfSel(); setStyle('dStyle', { arrow: !d.arrow }) }}>Flèche</Toggle>}
              </div>
            </>
          )}

          {k === 'move' && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-[13px] text-muted">
              <MousePointerClick size={20} className="shrink-0" />Rien de sélectionné pour l'instant.
            </div>
          )}

          {sel && (
            <Button variant="danger-ghost" size="sm" className="self-start -ml-2.5" onClick={() => s.removeItem(sel.kind, sel.id)}>
              <Trash2 size={15} />Supprimer l'élément <Kbd>Suppr</Kbd>
            </Button>
          )}
        </motion.section>
      </AnimatePresence>

      <div className="mt-auto flex flex-col gap-5 border-t border-line px-5 py-5">
        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold">Image enregistrée</h3>
          <Switch id="stamp" label="Afficher l'heure du relevé" checked={s.stamp} onCheckedChange={(v) => s.setPref('stamp', v)} />
          <Switch id="showCount" label="Afficher le nombre de places occupées" checked={s.showCount} onCheckedChange={(v) => s.setPref('showCount', v)} />
          <Switch id="autoClear" label="Vider les X après l'enregistrement" checked={s.autoClear} onCheckedChange={(v) => s.setPref('autoClear', v)} />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="mb-1 text-[13px] font-semibold">Effacer</h3>
          <Button id="clearX" variant="danger-ghost" size="sm" className="justify-start" onClick={clearMarks}><X size={15} strokeWidth={2.6} />Les X</Button>
          <Button id="clearShapes" variant="danger-ghost" size="sm" className="justify-start" onClick={clearShapes}><Square size={15} />Les rectangles et circuits</Button>
          <Button id="clearAll" variant="danger-ghost" size="sm" className="justify-start" onClick={clearAll}><Trash2 size={15} />Tout le plan</Button>
        </div>
      </div>
    </aside>
  )
}

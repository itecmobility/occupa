import { useStore, clean } from './store'
import { canvasApi } from './CanvasView'
import { ask } from './dialogs'

export async function save() {
  const s = useStore.getState(), p = s.plan(); if (!p || !canvasApi.exportBlob) return
  if (s.draftPathId) s.finishPath()
  let name = clean(s.fname.trim() || 'releve'); if (!name.toLowerCase().endsWith('.png')) name += '.png'
  const blob = await canvasApi.exportBlob()
  let ok = false
  // téléphone / tablette : feuille de partage (Enregistrer dans Photos, Fichiers, envoyer…)
  const file = typeof File !== 'undefined' ? new File([blob], name, { type: 'image/png' }) : null
  if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); ok = true } catch (e) { if (e.name === 'AbortError') return }
  }
  if (!ok && window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Image PNG', accept: { 'image/png': ['.png'] } }] })
      const w = await h.createWritable(); await w.write(blob); await w.close(); ok = true; name = h.name
    } catch (e) { if (e.name === 'AbortError') return }
  }
  if (!ok) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  ask.toast(`Enregistré : ${name}`, { description: `${p.marks.length} place${p.marks.length > 1 ? 's' : ''} occupée${p.marks.length > 1 ? 's' : ''}` })
  if (s.autoClear) { s.clear(['marks']); s.select(null) }
}

export function clearMarks() {
  const s = useStore.getState(), p = s.plan()
  if (!p?.marks.length) return ask.toast('Aucun X à effacer')
  const n = p.marks.length; s.clear(['marks']); s.select(null)
  ask.toast(`${n} X effacé${n > 1 ? 's' : ''}`, { action: { label: 'Annuler', onClick: () => useStore.getState().undo() } })
}
export function clearShapes() {
  const s = useStore.getState(); if (s.draftPathId) s.finishPath()
  const p = s.plan()
  if (!p?.shapes.length) return ask.toast('Aucun dessin à effacer')
  s.clear(['shapes']); s.select(null)
  ask.toast('Rectangles et circuits effacés', { action: { label: 'Annuler', onClick: () => useStore.getState().undo() } })
}
export async function clearAll() {
  const s = useStore.getState(); if (s.draftPathId) s.finishPath()
  const p = s.plan()
  if (!p || (!p.marks.length && !p.texts.length && !p.shapes.length)) return ask.toast('Rien à effacer')
  const ok = await ask.confirm({ title: 'Tout effacer ?', description: `Tous les X, textes, rectangles et circuits de « ${p.name} » seront retirés. Vous pourrez annuler avec Ctrl+Z.`, ok: 'Tout effacer', danger: true })
  if (ok) { s.clear(['marks', 'texts', 'shapes']); s.select(null) }
}
export function stepTextSize(dir) {
  const s = useStore.getState(), v = s.tStyle.size
  if (s.selected) s.snapshot()
  s.setStyle('tStyle', { size: Math.max(8, Math.min(400, v + dir * Math.max(2, Math.round(v * 0.1)))) })
}

/* ---------- installation (PWA) ---------- */
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const canInstall = (s) => !isStandalone() && location.protocol.startsWith('http') && (!!s.installEvt || isIOS())
export async function install() {
  const evt = useStore.getState().installEvt
  if (evt) {
    evt.prompt()
    const { outcome } = await evt.userChoice
    useStore.setState({ installEvt: null })
    if (outcome === 'accepted') ask.toast('Occupa est installé', { description: 'Retrouvez-le avec vos applications.' })
    return
  }
  await ask.confirm({
    title: 'Installer Occupa sur l\'iPhone ou l\'iPad',
    description: 'Dans Safari, touchez le bouton Partager (le carré avec une flèche), puis « Sur l\'écran d\'accueil ». Occupa s\'ouvrira ensuite comme une application, même hors connexion.',
    ok: 'Compris', danger: false,
  })
}

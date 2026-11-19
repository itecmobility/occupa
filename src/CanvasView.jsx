import { useEffect, useRef, useCallback } from 'react'
import { useStore, translate } from './store'
import { renderPlan, hitText, hitMark, hitShape, snapPoint, textBox, handlePos, normRect, hitRectHandle, resizeRect, HANDLE_CURSOR } from './draw'
import { ask } from './dialogs'

export const canvasApi = { exportBlob: null, fit: null }
function stampFor(s, p) {
  const lines = []
  if (s.stamp) lines.push(`Relevé ${s.hour}h${s.minute}`)
  if (s.showCount) { const n = p.marks.length; lines.push(`${n} place${n > 1 ? 's' : ''} occupée${n > 1 ? 's' : ''}`) }
  return lines.length ? lines.join('\n') : null
}

export default function CanvasView() {
  const cvRef = useRef(null), mainRef = useRef(null)
  const imgRef = useRef(new Image())
  const hoverRef = useRef(null), dragRef = useRef(null), draftRectRef = useRef(null)
  const plan = useStore((s) => s.plan())
  const zoom = useStore((s) => s.zoom)
  const st = useStore()

  const stampText = st.stamp ? `Relevé ${st.hour}h${st.minute}` : null

  const draw = useCallback((exp = false) => {
    const cv = cvRef.current, s = useStore.getState(), p = s.plan()
    if (!cv || !p) return
    const item = s.selectedItem()
    renderPlan(cv.getContext('2d'), imgRef.current, p, {
      export: exp, zoom: s.zoom, draftId: s.draftPathId, hover: hoverRef.current,
      selected: item ? { kind: s.selected.kind, item } : null,
      stamp: stampFor(s, p),
    })
  }, [])

  const fit = useCallback(() => {
    const cv = cvRef.current, m = mainRef.current
    if (!cv || !m || !cv.width) return
    useStore.getState().setZoom(Math.min((m.clientWidth - 64) / cv.width, (m.clientHeight - 96) / cv.height))
  }, [])

  // charge l'image du plan
  const src = plan?.src, planId = plan?.id
  useEffect(() => {
    if (!src) return
    const img = imgRef.current
    img.onload = () => {
      const cv = cvRef.current; cv.width = img.naturalWidth; cv.height = img.naturalHeight
      fit(); draw()
    }
    img.src = src
  }, [src, planId, fit, draw])

  // redessine à chaque changement d'état
  useEffect(() => { draw() })
  useEffect(() => { document.fonts?.ready.then(() => draw()) }, [draw])

  useEffect(() => {
    canvasApi.fit = fit
    canvasApi.exportBlob = () => new Promise((res) => { draw(true); cvRef.current.toBlob((b) => { draw(); res(b) }, 'image/png') })
  }, [fit, draw])

  useEffect(() => {
    const onResize = () => {}; window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ---------- souris ---------- */
  const pos = (e) => { const cv = cvRef.current, r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height } }
  const tol = () => 8 / useStore.getState().zoom

  const onHandle = (p) => {
    const s = useStore.getState(); if (s.selected?.kind !== 't') return null
    const t = s.selectedItem(); if (!t) return null
    const h = handlePos(t), r = 11 / s.zoom
    return Math.abs(p.x - h.x) <= r && Math.abs(p.y - h.y) <= r ? t : null
  }

  const onRectHandle = (p) => {
    const s = useStore.getState(); if (s.selected?.kind !== 's') return null
    const r = s.selectedItem(); if (!r || r.type !== 'rect') return null
    const h = hitRectHandle(r, p, 9 / s.zoom); return h ? { r, h } : null
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    const s = useStore.getState(), p0 = s.plan(); if (!p0) return
    const p = pos(e)
    const ht = !s.draftPathId && onHandle(p)
    if (ht) { s.snapshot(); const b = textBox(ht); dragRef.current = { resize: ht.id, w0: b.w, h0: b.h, s0: ht.size, x: ht.x, y: ht.y, moved: false }; return }
    const rh = !s.draftPathId && onRectHandle(p)
    if (rh) { s.snapshot(); dragRef.current = { rectResize: rh.r.id, k: rh.h.k, orig: normRect(rh.r), moved: false }; return }

    if (s.mode === 'path') {
      const q = snapPoint(p0, p, 12 / s.zoom, s.draftPathId)
      if (!s.draftPathId) {
        const d = s.dStyle
        const o = s.addItem('s', { type: 'path', pts: [{ x: q.x, y: q.y }], color: d.color, width: d.width, dash: d.dash, node: d.node, arrow: d.arrow })
        useStore.setState({ draftPathId: o.id, selected: null })
      } else s.updateItem('s', s.draftPathId, (o) => ({ ...o, pts: [...o.pts, { x: q.x, y: q.y }] }))
      return
    }
    if (s.mode === 'rect') {
      const d = s.dStyle
      const o = s.addItem('s', { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color: d.color, width: d.width, dash: d.dash, fill: d.fill })
      draftRectRef.current = { id: o.id, x: p.x, y: p.y }; s.select(null); return
    }
    const t = hitText(p0, p)
    if (t) {
      s.snapshot(); s.select({ kind: 't', id: t.id })
      useStore.setState({ tStyle: { color: t.color, size: t.size, bold: t.bold, bg: t.bg } })
      dragRef.current = { kind: 't', id: t.id, dx: p.x - t.x, dy: p.y - t.y, moved: false }; return
    }
    if (s.mode === 'mark') {
      const m = hitMark(p0, p)
      if (m) s.removeItem('m', m.id)
      else { const x = s.xStyle; s.addItem('m', { x: p.x, y: p.y, size: x.size, width: x.width, color: x.color }) }
      s.select(null)
    } else if (s.mode === 'text') {
      const val = s.textValue.trim()
      if (!val) { ask.toast('Tapez d\'abord le texte dans le panneau de droite'); document.getElementById('txt')?.focus(); return }
      const ts = s.tStyle
      const o = s.addItem('t', { text: val, x: p.x, y: p.y - ts.size / 2, size: ts.size, color: ts.color, bold: ts.bold, bg: ts.bg })
      s.select({ kind: 't', id: o.id })
    } else {
      const m = hitMark(p0, p)
      if (m) { s.snapshot(); s.select({ kind: 'm', id: m.id }); useStore.setState({ xStyle: { color: m.color, size: m.size, width: m.width } }); dragRef.current = { kind: 'm', id: m.id, dx: p.x - m.x, dy: p.y - m.y, moved: false }; return }
      const sh = hitShape(p0, p, tol(), s.draftPathId)
      if (sh) {
        s.snapshot(); s.select({ kind: 's', id: sh.id })
        useStore.setState({ dStyle: { ...s.dStyle, color: sh.color, width: sh.width, dash: !!sh.dash, ...(sh.type === 'rect' ? { fill: !!sh.fill } : { node: sh.node, arrow: !!sh.arrow }) } })
        dragRef.current = { kind: 's', id: sh.id, last: p, moved: false }; return
      }
      s.select(null)
    }
  }

  useEffect(() => {
    const move = (e) => {
      const s = useStore.getState(), p0 = s.plan(); if (!p0 || !cvRef.current) return
      const p = pos(e)
      if (s.draftPathId) { hoverRef.current = snapPoint(p0, p, 12 / s.zoom, s.draftPathId); draw(); return }
      hoverRef.current = null
      const dr = draftRectRef.current
      if (dr) { s.updateItem('s', dr.id, { w: p.x - dr.x, h: p.y - dr.y }); return }
      const d = dragRef.current
      if (!d) {
        if (e.target === cvRef.current) { const rh = onRectHandle(p); cvRef.current.style.cursor = onHandle(p) ? 'nwse-resize' : rh ? HANDLE_CURSOR[rh.h.k] : '' }
        return
      }
      d.moved = true
      if (d.rectResize) { s.updateItem('s', d.rectResize, resizeRect(d.orig, d.k, p)); return }
      if (d.resize) {
        const k = Math.max((p.x - d.x - 8) / d.w0, (p.y - d.y - 6) / d.h0)
        const size = Math.round(Math.max(8, Math.min(400, d.s0 * k)))
        s.updateItem('t', d.resize, { size }); useStore.setState({ tStyle: { ...s.tStyle, size } }); return
      }
      if (d.kind === 's') { s.updateItem('s', d.id, (o) => translate(o, p.x - d.last.x, p.y - d.last.y)); d.last = p }
      else s.updateItem(d.kind, d.id, { x: p.x - d.dx, y: p.y - d.dy })
    }
    const up = () => {
      const s = useStore.getState()
      const dr = draftRectRef.current
      if (dr) {
        draftRectRef.current = null
        const o = s.plan().shapes.find((x) => x.id === dr.id)
        if (!o || Math.abs(o.w) < 4 || Math.abs(o.h) < 4) { s.patchPlan((pl) => ({ ...pl, shapes: pl.shapes.filter((x) => x.id !== dr.id) }), false); s.dropSnapshot() }
        else { s.updateItem('s', dr.id, normRect(o)); s.select({ kind: 's', id: dr.id }) }
        return
      }
      const d = dragRef.current
      if (d) {
        if (!d.moved) s.dropSnapshot()
        else if (d.rectResize) { const o = s.plan().shapes.find((x) => x.id === d.rectResize); if (o) s.updateItem('s', o.id, normRect(o)) }
        dragRef.current = null
      }
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [draw])

  async function onDoubleClick(e) {
    const s = useStore.getState(), p0 = s.plan(); if (!p0) return
    if (s.mode === 'path') { s.finishPath(); hoverRef.current = null; return }
    if (s.mode === 'rect') return
    const t = hitText(p0, pos(e)); if (!t) return
    const v = await ask.prompt({ title: 'Modifier le texte', description: 'Laissez vide pour supprimer ce texte.', value: t.text, ok: 'Enregistrer' })
    if (v === null) return
    if (v.trim() === '') s.removeItem('t', t.id); else s.updateItem('t', t.id, { text: v }, true)
  }
  function onContextMenu(e) {
    const s = useStore.getState(), p0 = s.plan(); if (!p0) return
    if (s.draftPathId) { e.preventDefault(); s.finishPath(); hoverRef.current = null; return }
    const p = pos(e)
    const t = hitText(p0, p); if (t) { e.preventDefault(); s.removeItem('t', t.id); return }
    const m = hitMark(p0, p); if (m) { e.preventDefault(); s.removeItem('m', m.id); return }
    const sh = hitShape(p0, p, tol()); if (sh) { e.preventDefault(); s.removeItem('s', sh.id) }
  }
  function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault(); const s = useStore.getState(); s.setZoom(s.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  }
  useEffect(() => {
    const m = mainRef.current; m.addEventListener('wheel', onWheel, { passive: false })
    return () => m.removeEventListener('wheel', onWheel)
  }, [])

  const cursor = { mark: 'crosshair', rect: 'crosshair', path: 'crosshair', text: 'text', move: 'default' }[st.mode]
  const cv = cvRef.current
  return (
    <main ref={mainRef} className="stage-grid relative h-full overflow-auto">
      <div className="inline-flex min-h-full min-w-full items-center justify-center p-8 pb-20">
        <canvas
          ref={cvRef} id="cv"
          onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}
          className="block rounded-[3px] bg-white shadow-float ring-1 ring-black/5"
          style={{ cursor, width: cv ? cv.width * zoom : undefined, height: cv ? cv.height * zoom : undefined, display: plan ? 'block' : 'none' }}
          data-stamp={stampText || ''}
        />
      </div>
    </main>
  )
}

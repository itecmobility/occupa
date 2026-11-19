import { useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useStore, translate } from './store'
import { renderPlan, hitText, hitMark, hitShape, snapPoint, textBox, handlePos, normRect, hitRectHandle, resizeRect, HANDLE_CURSOR } from './draw'
import { ask } from './dialogs'

export const canvasApi = { exportBlob: null, fit: null, zoomAt: null, editText: null }
function stampFor(s, p) {
  const lines = []
  if (s.stamp) lines.push(`Relevé ${s.hour}h${s.minute}`)
  if (s.showCount) { const n = p.marks.length; lines.push(`${n} place${n > 1 ? 's' : ''} occupée${n > 1 ? 's' : ''}`) }
  return lines.length ? lines.join('\n') : null
}

const TAP_SLOP = 8          // px écran avant de considérer qu'un doigt « glisse »
const TOUCH_COMMIT_MS = 110 // délai avant de valider un geste à un doigt (laisse le temps d'un pinch)

export default function CanvasView() {
  const cvRef = useRef(null), mainRef = useRef(null)
  const imgRef = useRef(new Image())
  const hoverRef = useRef(null), dragRef = useRef(null), draftRectRef = useRef(null), panRef = useRef(null)
  const ptrs = useRef(new Map())       // pointeurs actifs (multi-touch)
  const pending = useRef(null)          // geste tactile en attente de validation
  const pinch = useRef(null)
  const anchor = useRef(null)           // point à garder sous les doigts/la souris lors d'un zoom
  const lastTap = useRef(null)
  const touchMode = useRef(false)
  const plan = useStore((s) => s.plan())
  const zoom = useStore((s) => s.zoom)
  const st = useStore()

  const draw = useCallback((exp = false) => {
    const cv = cvRef.current, s = useStore.getState(), p = s.plan()
    if (!cv || !p) return
    const item = s.selectedItem()
    renderPlan(cv.getContext('2d'), imgRef.current, p, {
      export: exp, zoom: s.zoom, draftId: s.draftPathId, hover: hoverRef.current,
      selected: item ? { kind: s.selected.kind, item } : null,
      stamp: stampFor(s, p), touch: touchMode.current,
    })
  }, [])

  const fit = useCallback(() => {
    const cv = cvRef.current, m = mainRef.current
    if (!cv || !m || !cv.width) return
    const pad = m.clientWidth < 700 ? 24 : 64
    useStore.getState().setZoom(Math.min((m.clientWidth - pad) / cv.width, (m.clientHeight - pad - 40) / cv.height))
  }, [])

  // zoom en gardant le point (clientX, clientY) fixe à l'écran
  const zoomAt = useCallback((z, cx, cy) => {
    const cv = cvRef.current; if (!cv) return
    const r = cv.getBoundingClientRect(), s = useStore.getState()
    if (cx == null) { const m = mainRef.current.getBoundingClientRect(); cx = m.left + m.width / 2; cy = m.top + m.height / 2 }
    anchor.current = { ix: (cx - r.left) / s.zoom, iy: (cy - r.top) / s.zoom, cx, cy }
    s.setZoom(z)
  }, [])
  useLayoutEffect(() => {
    const a = anchor.current, cv = cvRef.current, m = mainRef.current
    if (!a || !cv || !m) return
    anchor.current = null
    const r = cv.getBoundingClientRect()
    m.scrollLeft += r.left + a.ix * zoom - a.cx
    m.scrollTop += r.top + a.iy * zoom - a.cy
  }, [zoom])

  const src = plan?.src, planId = plan?.id
  useEffect(() => {
    if (!src) return
    const img = imgRef.current
    img.onload = () => { const cv = cvRef.current; cv.width = img.naturalWidth; cv.height = img.naturalHeight; fit(); draw() }
    img.src = src
  }, [src, planId, fit, draw])

  useEffect(() => { draw() })
  useEffect(() => { document.fonts?.ready.then(() => draw()) }, [draw])
  useEffect(() => {
    canvasApi.fit = fit; canvasApi.zoomAt = zoomAt; canvasApi.editText = editText
    canvasApi.exportBlob = () => new Promise((res) => { draw(true); cvRef.current.toBlob((b) => { draw(); res(b) }, 'image/png') })
  }, [fit, draw, zoomAt])

  /* ---------- outils ---------- */
  const toImg = (cx, cy) => { const cv = cvRef.current, r = cv.getBoundingClientRect(); return { x: (cx - r.left) * cv.width / r.width, y: (cy - r.top) * cv.height / r.height } }
  const k = () => (touchMode.current ? 2.4 : 1)          // cibles plus grandes au doigt
  const tol = () => (8 * k()) / useStore.getState().zoom

  const onTextHandle = (p) => {
    const s = useStore.getState(); if (s.selected?.kind !== 't') return null
    const t = s.selectedItem(); if (!t) return null
    const h = handlePos(t), r = (11 * k()) / s.zoom
    return Math.abs(p.x - h.x) <= r && Math.abs(p.y - h.y) <= r ? t : null
  }
  const onRectHandle = (p) => {
    const s = useStore.getState(); if (s.selected?.kind !== 's') return null
    const r = s.selectedItem(); if (!r || r.type !== 'rect') return null
    const h = hitRectHandle(r, p, (9 * k()) / s.zoom); return h ? { r, h } : null
  }

  // début d'un geste à un pointeur (souris, stylet, ou doigt validé)
  function down(p, onCanvas, cx, cy) {
    const s = useStore.getState(), p0 = s.plan(); if (!p0) return
    const ht = !s.draftPathId && onTextHandle(p)
    if (ht) { s.snapshot(); const b = textBox(ht); dragRef.current = { resize: ht.id, w0: b.w, h0: b.h, s0: ht.size, x: ht.x, y: ht.y, moved: false }; return }
    const rh = !s.draftPathId && onRectHandle(p)
    if (rh) { s.snapshot(); dragRef.current = { rectResize: rh.r.id, k: rh.h.k, orig: normRect(rh.r), moved: false }; return }

    if (!onCanvas) { startPan(cx, cy); return }

    if (s.mode === 'path') {
      const q = snapPoint(p0, p, (12 * k()) / s.zoom, s.draftPathId)
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
      if (!val) { ask.toast('Écrivez d\'abord le texte dans les réglages'); useStore.setState({ sheetOpen: true }); setTimeout(() => document.getElementById('txt')?.focus(), 250); return }
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
      startPan(cx, cy)   // glisser dans le vide = déplacer la vue
    }
  }
  function startPan(cx, cy) { const m = mainRef.current; panRef.current = { cx, cy, sl: m.scrollLeft, st: m.scrollTop } }

  function move(p, cx, cy) {
    const s = useStore.getState()
    if (panRef.current) { const m = mainRef.current, P = panRef.current; m.scrollLeft = P.sl - (cx - P.cx); m.scrollTop = P.st - (cy - P.cy); return }
    const dr = draftRectRef.current
    if (dr) { s.updateItem('s', dr.id, { w: p.x - dr.x, h: p.y - dr.y }); return }
    const d = dragRef.current; if (!d) return
    d.moved = true
    if (d.rectResize) { s.updateItem('s', d.rectResize, resizeRect(d.orig, d.k, p)); return }
    if (d.resize) {
      const kk = Math.max((p.x - d.x - 8) / d.w0, (p.y - d.y - 6) / d.h0)
      const size = Math.round(Math.max(8, Math.min(400, d.s0 * kk)))
      s.updateItem('t', d.resize, { size }); useStore.setState({ tStyle: { ...s.tStyle, size } }); return
    }
    if (d.kind === 's') { s.updateItem('s', d.id, (o) => translate(o, p.x - d.last.x, p.y - d.last.y)); d.last = p }
    else s.updateItem(d.kind, d.id, { x: p.x - d.dx, y: p.y - d.dy })
  }

  function up() {
    const s = useStore.getState()
    panRef.current = null
    const dr = draftRectRef.current
    if (dr) {
      draftRectRef.current = null
      const o = s.plan()?.shapes.find((x) => x.id === dr.id)
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

  // annule un geste à un doigt déjà commencé (quand un 2e doigt arrive)
  function cancelGesture() {
    const s = useStore.getState()
    panRef.current = null
    if (draftRectRef.current) { const id = draftRectRef.current.id; draftRectRef.current = null; s.patchPlan((pl) => ({ ...pl, shapes: pl.shapes.filter((x) => x.id !== id) }), false); s.dropSnapshot() }
    if (dragRef.current) { const moved = dragRef.current.moved; dragRef.current = null; if (moved) s.undo(); else s.dropSnapshot() }
  }

  async function editText(t) {
    const s = useStore.getState()
    t = t || s.selectedItem(); if (!t || t.text == null) return
    const v = await ask.prompt({ title: 'Modifier le texte', description: 'Laissez vide pour supprimer ce texte.', value: t.text, ok: 'Enregistrer' })
    if (v === null) return
    if (v.trim() === '') s.removeItem('t', t.id); else s.updateItem('t', t.id, { text: v }, true)
  }
  function doubleAt(p) {
    const s = useStore.getState(), p0 = s.plan(); if (!p0) return
    if (s.mode === 'path') { s.finishPath(); hoverRef.current = null; draw(); return }
    if (s.mode === 'rect') return
    const t = hitText(p0, p); if (t) editText(t)
  }

  /* ---------- pointeurs ---------- */
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const main = mainRef.current
    touchMode.current = e.pointerType === 'touch'
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { main.setPointerCapture(e.pointerId) } catch {}
    const onCanvas = e.target === cvRef.current

    if (ptrs.current.size === 2) {           // début d'un pinch
      if (pending.current) { clearTimeout(pending.current.timer); pending.current = null }
      else cancelGesture()
      const [a, b] = [...ptrs.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: useStore.getState().zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, sl: main.scrollLeft, st: main.scrollTop }
      return
    }
    if (ptrs.current.size > 2) return

    if (e.pointerType === 'touch') {
      const pend = { cx: e.clientX, cy: e.clientY, onCanvas, committed: false }
      pend.timer = setTimeout(() => commitPending(), TOUCH_COMMIT_MS)
      pending.current = pend
    } else {
      down(toImg(e.clientX, e.clientY), onCanvas, e.clientX, e.clientY)
    }
  }
  function commitPending() {
    const pd = pending.current; if (!pd || pd.committed) return
    pd.committed = true; clearTimeout(pd.timer)
    if (!cvRef.current) return
    down(toImg(pd.cx, pd.cy), pd.onCanvas, pd.cx, pd.cy)
  }

  function onPointerMove(e) {
    const main = mainRef.current, cv = cvRef.current
    if (!cv) return
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinch.current && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const P = pinch.current, d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      main.scrollLeft = P.sl - (mx - P.mx); main.scrollTop = P.st - (my - P.my)
      P.sl = main.scrollLeft; P.st = main.scrollTop; P.mx = mx; P.my = my
      const nz = P.z * d / P.d
      if (Math.abs(nz - useStore.getState().zoom) > 0.002) zoomAt(nz, mx, my)
      return
    }

    const pd = pending.current
    if (pd && !pd.committed) {
      if (Math.hypot(e.clientX - pd.cx, e.clientY - pd.cy) > TAP_SLOP) commitPending()
      else return
    }

    const s = useStore.getState(), p = toImg(e.clientX, e.clientY)
    if (s.draftPathId && e.pointerType !== 'touch') { hoverRef.current = snapPoint(s.plan(), p, 12 / s.zoom, s.draftPathId); draw() }
    else if (hoverRef.current && !s.draftPathId) { hoverRef.current = null; draw() }

    if (!ptrs.current.has(e.pointerId)) {   // survol à la souris : curseur des poignées
      if (e.target === cv) { const rh = onRectHandle(p); cv.style.cursor = onTextHandle(p) ? 'nwse-resize' : rh ? HANDLE_CURSOR[rh.h.k] : '' }
      return
    }
    move(p, e.clientX, e.clientY)
  }

  function onPointerUp(e) {
    const had = ptrs.current.delete(e.pointerId)
    if (!had) return
    if (pinch.current) { if (ptrs.current.size < 2) pinch.current = null; if (ptrs.current.size === 0) cancelGesture(); return }
    const pd = pending.current
    if (pd) {
      const wasTap = !pd.committed
      if (wasTap) commitPending()
      pending.current = null
      up()
      if (wasTap && e.pointerType === 'touch') {      // double-tap
        const now = Date.now(), lt = lastTap.current
        if (lt && now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) { lastTap.current = null; doubleAt(toImg(e.clientX, e.clientY)) }
        else lastTap.current = { t: now, x: e.clientX, y: e.clientY }
      }
      return
    }
    up()
  }

  function onDoubleClick(e) { if (e.target === cvRef.current) doubleAt(toImg(e.clientX, e.clientY)) }
  function onContextMenu(e) {
    e.preventDefault()
    const s = useStore.getState(), p0 = s.plan(); if (!p0 || e.target !== cvRef.current) return
    if (s.draftPathId) { s.finishPath(); hoverRef.current = null; return }
    const p = toImg(e.clientX, e.clientY)
    const t = hitText(p0, p); if (t) return s.removeItem('t', t.id)
    const m = hitMark(p0, p); if (m) return s.removeItem('m', m.id)
    const sh = hitShape(p0, p, tol()); if (sh) s.removeItem('s', sh.id)
  }
  useEffect(() => {
    const m = mainRef.current
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault(); const s = useStore.getState(); zoomAt(s.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY)
    }
    m.addEventListener('wheel', onWheel, { passive: false })
    return () => m.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const cursor = { mark: 'crosshair', rect: 'crosshair', path: 'crosshair', text: 'text', move: 'grab' }[st.mode]
  const cv = cvRef.current
  return (
    <main ref={mainRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}
      className="stage-grid relative h-full touch-none select-none overflow-auto overscroll-contain">
      <div className="inline-flex min-h-full min-w-full items-center justify-center p-3 pb-28 sm:p-8 sm:pb-24">
        <canvas ref={cvRef} id="cv"
          className="block rounded-[3px] bg-white shadow-float ring-1 ring-black/5"
          style={{ cursor, width: cv ? cv.width * zoom : undefined, height: cv ? cv.height * zoom : undefined, display: plan ? 'block' : 'none' }} />
      </div>
    </main>
  )
}

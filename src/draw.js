// Dessin et détection des éléments sur le plan (coordonnées en pixels de l'image)
let mctx = null
const measureCtx = () => (mctx ||= document.createElement('canvas').getContext('2d'))

export const textFont = (t) => `${t.bold ? '700 ' : '500 '}${t.size}px "Geist Variable", Arial, sans-serif`
export function textBox(t) {
  const c = measureCtx(); c.font = textFont(t)
  const lines = t.text.split('\n'), lh = t.size * 1.15
  const w = Math.max(...lines.map((l) => c.measureText(l).width))
  return { x: t.x, y: t.y, w, h: lh * lines.length, lines, lh }
}
export const normRect = (s) => ({ x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w), h: Math.abs(s.h) })
export function shapeBox(s) {
  if (s.type === 'rect') return normRect(s)
  const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
export const RECT_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const HANDLE_CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
export function rectHandles(s) {
  const r = normRect(s), cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const P = { nw: [r.x, r.y], n: [cx, r.y], ne: [r.x + r.w, r.y], e: [r.x + r.w, cy], se: [r.x + r.w, r.y + r.h], s: [cx, r.y + r.h], sw: [r.x, r.y + r.h], w: [r.x, cy] }
  return RECT_HANDLES.map((k) => ({ k, x: P[k][0], y: P[k][1] }))
}
export function hitRectHandle(s, p, tol) { return rectHandles(s).find((h) => Math.abs(p.x - h.x) <= tol && Math.abs(p.y - h.y) <= tol) || null }
export function resizeRect(orig, k, p) {
  let x1 = orig.x, y1 = orig.y, x2 = orig.x + orig.w, y2 = orig.y + orig.h
  if (k.includes('w')) x1 = p.x
  if (k.includes('e')) x2 = p.x
  if (k.includes('n')) y1 = p.y
  if (k.includes('s')) y2 = p.y
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
export const handlePos = (t) => { const b = textBox(t); return { x: b.x + b.w + 8, y: b.y + b.h + 6 } }

function drawX(ctx, m) {
  const s = m.size / 2
  ctx.strokeStyle = m.color; ctx.lineWidth = m.width; ctx.lineCap = 'round'; ctx.setLineDash([])
  ctx.beginPath(); ctx.moveTo(m.x - s, m.y - s); ctx.lineTo(m.x + s, m.y + s); ctx.moveTo(m.x + s, m.y - s); ctx.lineTo(m.x - s, m.y + s); ctx.stroke()
}
function drawText(ctx, t) {
  const b = textBox(t)
  if (t.bg) { ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(b.x - 6, b.y - 4, b.w + 12, b.h + 8) }
  ctx.fillStyle = t.color; ctx.textBaseline = 'top'; ctx.font = textFont(t)
  b.lines.forEach((l, i) => ctx.fillText(l, b.x, b.y + i * b.lh))
}
function drawShape(ctx, s, hover) {
  ctx.save()
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.setLineDash(s.dash ? [s.width * 3, s.width * 2] : [])
  if (s.type === 'rect') {
    const r = normRect(s)
    if (s.fill) { ctx.globalAlpha = 0.2; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1 }
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  } else {
    const pts = hover ? [...s.pts, hover] : s.pts
    if (pts.length > 1) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((q) => ctx.lineTo(q.x, q.y)); ctx.stroke() }
    ctx.setLineDash([])
    if (s.arrow && pts.length > 1) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1], ang = Math.atan2(b.y - a.y, b.x - a.x), L = Math.max(12, s.width * 4)
      ctx.beginPath(); ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45))
      ctx.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill()
    }
    if (s.node > 0) s.pts.forEach((q, i) => {
      if (s.arrow && i === s.pts.length - 1 && !hover) return
      ctx.beginPath(); ctx.arc(q.x, q.y, s.node / 2, 0, Math.PI * 2); ctx.fill()
    })
  }
  ctx.restore()
}

export function renderPlan(ctx, img, plan, o = {}) {
  const { width: W, height: H } = ctx.canvas
  ctx.clearRect(0, 0, W, H)
  if (img && img.naturalWidth) ctx.drawImage(img, 0, 0)
  plan.shapes.forEach((s) => drawShape(ctx, s, !o.export && s.id === o.draftId ? o.hover : null))
  plan.marks.forEach((m) => drawX(ctx, m))
  plan.texts.forEach((t) => drawText(ctx, t))
  if (o.stamp) {
    const st = { text: o.stamp, size: Math.max(14, Math.round(W / 40)), color: '#0f1f3d', bold: true, bg: true, y: 20, x: 0 }
    st.x = W - textBox(st).w - 30
    drawText(ctx, st)
  }
  if (o.export) return
  const z = o.zoom || 1
  if (o.selected) {
    const { kind, item } = o.selected
    const isRect = kind === 's' && item.type === 'rect'
    const b = kind === 't' ? textBox(item) : kind === 's' ? shapeBox(item) : { x: item.x - item.size / 2, y: item.y - item.size / 2, w: item.size, h: item.size }
    if (!isRect) { ctx.save(); ctx.setLineDash([6 / z, 4 / z]); ctx.strokeStyle = '#2f62e8'; ctx.lineWidth = 1.5 / z
      ctx.strokeRect(b.x - 8, b.y - 6, b.w + 16, b.h + 12); ctx.restore() }
    else {
      ctx.save(); ctx.strokeStyle = '#2f62e8'; ctx.lineWidth = 1.5 / z; ctx.strokeRect(b.x, b.y, b.w, b.h)
      const r = (o.touch ? 9 : 5) / z; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.5 / z
      rectHandles(item).forEach((h) => { ctx.fillRect(h.x - r, h.y - r, 2 * r, 2 * r); ctx.strokeRect(h.x - r, h.y - r, 2 * r, 2 * r) })
      ctx.restore()
    }
    if (kind === 't') {
      const h = handlePos(item), r = (o.touch ? 11 : 6) / z
      ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2f62e8'; ctx.lineWidth = 2 / z
      ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore()
    }
  }
  if (o.hover && o.hover.snap) {
    ctx.save(); ctx.strokeStyle = '#2f62e8'; ctx.lineWidth = 2 / z
    ctx.beginPath(); ctx.arc(o.hover.x, o.hover.y, 10 / z, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }
}

/* ---------- hit testing ---------- */
export function hitText(plan, p) {
  for (let i = plan.texts.length - 1; i >= 0; i--) {
    const b = textBox(plan.texts[i])
    if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 4 && p.y <= b.y + b.h + 4) return plan.texts[i]
  }
  return null
}
export function hitMark(plan, p) {
  for (let i = plan.marks.length - 1; i >= 0; i--) {
    const m = plan.marks[i], r = Math.max(m.size / 2 + 4, 10)
    if (Math.abs(p.x - m.x) <= r && Math.abs(p.y - m.y) <= r) return m
  }
  return null
}
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy
  let t = L ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0; t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
export function hitShape(plan, p, tol, skipId) {
  for (let i = plan.shapes.length - 1; i >= 0; i--) {
    const s = plan.shapes[i]; if (s.id === skipId) continue
    if (s.type === 'rect') {
      const r = normRect(s), m = s.width / 2 + tol
      if (p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m) return s
    } else {
      for (let j = 1; j < s.pts.length; j++) if (segDist(p, s.pts[j - 1], s.pts[j]) <= s.width / 2 + tol) return s
      if (s.pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= s.node / 2 + tol)) return s
    }
  }
  return null
}
export function snapPoint(plan, p, tol, draftId) {
  let best = null, bd = tol
  plan.shapes.forEach((s) => {
    if (s.type !== 'path') return
    s.pts.forEach((q, i) => {
      if (s.id === draftId && i === s.pts.length - 1) return
      const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q }
    })
  })
  return best ? { x: best.x, y: best.y, snap: true } : { x: p.x, y: p.y }
}

import { create } from 'zustand'
import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Crop, Maximize2, Scan } from 'lucide-react'
import { Button } from './components/ui'

const useDialog = create(() => ({ d: null }))
const open = (d) => new Promise((resolve) => useDialog.setState({ d: { ...d, resolve } }))
const close = (v) => { const d = useDialog.getState().d; useDialog.setState({ d: null }); d?.resolve(v) }

export const ask = {
  confirm: (o) => open({ type: 'confirm', ...o }),
  prompt: (o) => open({ type: 'prompt', ...o }),
  crop: (o) => open({ type: 'crop', ...o }),
  toast: (m, o) => toast(m, o),
}
export const isDialogOpen = () => !!useDialog.getState().d

export function DialogHost() {
  const d = useDialog((s) => s.d)
  return (
    <Dialog.Root open={!!d} onOpenChange={(o) => !o && close(d?.type === 'confirm' ? false : null)}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div className="fixed inset-0 z-40 bg-[#050b17]/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        </Dialog.Overlay>
        {d && (
          <Dialog.Content asChild aria-describedby={undefined} onOpenAutoFocus={(e) => d.type === 'crop' && e.preventDefault()}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }}
              className={'fixed left-1/2 top-1/2 z-50 flex max-h-[94dvh] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-fg shadow-2xl sm:p-6 ' + (d.type === 'crop' ? '' : 'w-[min(440px,calc(100vw-24px))]')}
            >
              {d.type === 'confirm' && <ConfirmBody d={d} />}
              {d.type === 'prompt' && <PromptBody d={d} />}
              {d.type === 'crop' && <CropBody d={d} />}
            </motion.div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Head({ title, description }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
      {description && <p className="max-w-[60ch] text-sm leading-relaxed text-muted">{description}</p>}
    </div>
  )
}

function ConfirmBody({ d }) {
  return (
    <>
      <Head title={d.title} description={d.description} />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => close(false)}>Annuler</Button>
        <Button variant={d.danger ? 'danger' : 'primary'} autoFocus onClick={() => close(true)}>{d.ok || 'Confirmer'}</Button>
      </div>
    </>
  )
}

function PromptBody({ d }) {
  const [v, setV] = useState(d.value || '')
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.select(), 30) }, [])
  return (
    <div className="flex flex-col gap-4">
      <Head title={d.title} description={d.description} />
      <input ref={ref} value={v} onChange={(e) => setV(e.target.value)} placeholder={d.placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); close(v) } }}
        className="h-11 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => close(null)}>Annuler</Button>
        <Button type="button" variant="primary" onClick={() => close(v)}>{d.ok || 'Valider'}</Button>
      </div>
    </div>
  )
}

function CropBody({ d }) {
  const cRef = useRef(null)
  const state = useRef({ im: null, s: 1, r: null, act: null })
  const [info, setInfo] = useState('')

  useEffect(() => {
    const im = new Image()
    im.onload = () => {
      const c = cRef.current, S = state.current
      const s = Math.min((window.innerWidth * 0.94 - 40) / im.width, (window.innerHeight * 0.94 - (window.innerWidth < 640 ? 300 : 210)) / im.height, 1)
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s)
      Object.assign(S, { im, s }); redraw()
    }
    im.src = d.src
  }, [])

  const norm = (q) => ({ x: Math.min(q.x, q.x + q.w), y: Math.min(q.y, q.y + q.h), w: Math.abs(q.w), h: Math.abs(q.h) })
  const corners = (q) => [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]]
  const P = (e) => { const c = cRef.current, b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * c.width / b.width, y: (e.clientY - b.top) * c.height / b.height } }
  function clamp(q) { const c = cRef.current; q = norm(q); q.x = Math.max(0, q.x); q.y = Math.max(0, q.y); q.w = Math.min(c.width - q.x, q.w); q.h = Math.min(c.height - q.y, q.h); return q }
  function redraw() {
    const c = cRef.current, g = c.getContext('2d'), { im, s, r } = state.current; if (!im) return
    g.drawImage(im, 0, 0, c.width, c.height)
    if (r && r.w && r.h) {
      const q = norm(r)
      g.fillStyle = 'rgba(7,14,28,.55)'
      g.fillRect(0, 0, c.width, q.y); g.fillRect(0, q.y + q.h, c.width, c.height - q.y - q.h)
      g.fillRect(0, q.y, q.x, q.h); g.fillRect(q.x + q.w, q.y, c.width - q.x - q.w, q.h)
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(q.x + .5, q.y + .5, q.w, q.h)
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1
      for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(q.x + q.w * i / 3, q.y); g.lineTo(q.x + q.w * i / 3, q.y + q.h); g.moveTo(q.x, q.y + q.h * i / 3); g.lineTo(q.x + q.w, q.y + q.h * i / 3); g.stroke() }
      g.fillStyle = '#fff'
      corners(q).forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill() })
      setInfo(`${Math.round(q.w / s)} × ${Math.round(q.h / s)} px`)
    } else setInfo(`Image entière · ${im.width} × ${im.height} px`)
  }
  function onDown(e) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const S = state.current, p = P(e), T = e.pointerType === 'touch' ? 22 : 11
    if (S.r && S.r.w && S.r.h) {
      const q = norm(S.r); S.r = q
      const ci = corners(q).findIndex(([x, y]) => Math.abs(p.x - x) < T && Math.abs(p.y - y) < T)
      if (ci >= 0) { const [ox, oy] = corners(q)[3 - ci]; S.act = { t: 'new', ox, oy }; S.r = { x: ox, y: oy, w: p.x - ox, h: p.y - oy }; redraw(); return }
      if (p.x > q.x && p.x < q.x + q.w && p.y > q.y && p.y < q.y + q.h) { S.act = { t: 'move', dx: p.x - q.x, dy: p.y - q.y }; return }
    }
    S.act = { t: 'new', ox: p.x, oy: p.y }; S.r = { x: p.x, y: p.y, w: 0, h: 0 }; redraw()
  }
  function onMove(e) {
    const S = state.current, c = cRef.current; if (!S.act || !c) return
    const p = P(e)
    if (S.act.t === 'new') S.r = { x: S.act.ox, y: S.act.oy, w: Math.max(0, Math.min(c.width, p.x)) - S.act.ox, h: Math.max(0, Math.min(c.height, p.y)) - S.act.oy }
    else { const q = norm(S.r); S.r = { x: Math.max(0, Math.min(c.width - q.w, p.x - S.act.dx)), y: Math.max(0, Math.min(c.height - q.h, p.y - S.act.dy)), w: q.w, h: q.h } }
    redraw()
  }
  function onUp() { const S = state.current; if (S.act) { S.act = null; if (S.r) S.r = clamp(S.r); redraw() } }
  function doCrop() {
    const S = state.current
    if (!S.r || S.r.w < 5 || S.r.h < 5) { toast('Tracez d\'abord un rectangle sur l\'image'); return }
    const q = clamp(S.r), s = S.s
    const box = { x: Math.round(q.x / s), y: Math.round(q.y / s), w: Math.round(q.w / s), h: Math.round(q.h / s) }
    const out = document.createElement('canvas'); out.width = box.w; out.height = box.h
    out.getContext('2d').drawImage(S.im, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
    close({ src: out.toDataURL('image/png'), box })
  }
  return (
    <>
      <Head title={d.title} description="Tracez un rectangle sur la partie à garder. Glissez l'intérieur pour le déplacer, les coins pour l'ajuster." />
      <div className="overflow-hidden rounded-xl bg-sunken ring-1 ring-line">
        <canvas ref={cRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="mx-auto block max-w-full cursor-crosshair touch-none" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-full text-sm text-muted sm:mr-auto sm:w-auto">{info}</span>
        <Button variant="ghost" onClick={() => { state.current.r = { x: 0, y: 0, w: cRef.current.width, h: cRef.current.height }; redraw() }}><Scan size={16} />Tout sélectionner</Button>
        <Button variant="ghost" onClick={() => close(null)}>Annuler</Button>
        <Button variant="outline" onClick={() => close({ src: d.src, box: null })}><Maximize2 size={16} />Garder l'image entière</Button>
        <Button variant="primary" onClick={doCrop}><Crop size={16} />Rogner</Button>
      </div>
    </>
  )
}

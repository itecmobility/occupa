import { create } from 'zustand'

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const pad = (n) => String(n).padStart(2, '0')
export const clean = (s) => s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_')

/* ---------------- IndexedDB (même base que les versions précédentes) ---------------- */
let db = null
function openDB() {
  return new Promise((res) => {
    try {
      const rq = indexedDB.open('releveParking', 1)
      rq.onupgradeneeded = () => rq.result.createObjectStore('plans', { keyPath: 'id' })
      rq.onsuccess = () => { db = rq.result; res() }
      rq.onerror = () => res()
    } catch { res() }
  })
}
const dbAll = () => new Promise((res) => {
  if (!db) return res([])
  try { const rq = db.transaction('plans').objectStore('plans').getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]) } catch { res([]) }
})
const dbPut = (p) => { if (!db) return; try { db.transaction('plans', 'readwrite').objectStore('plans').put(p) } catch {} }
const dbDel = (id) => { if (!db) return; try { db.transaction('plans', 'readwrite').objectStore('plans').delete(id) } catch {} }
const meta = {
  get: (k) => { try { return localStorage.getItem('releve_' + k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem('releve_' + k, v) } catch {} },
}

export const LAYERS = [
  { key: 'strokes', label: 'Corrections (effaceur)', short: 'Effaceur', kind: 'e' },
  { key: 'shapes', label: 'Rectangles et circuits', short: 'Dessins', kind: 's' },
  { key: 'marks', label: 'Places occupées (X)', short: 'Places (X)', kind: 'm' },
  { key: 'texts', label: 'Textes', short: 'Textes', kind: 't' },
]
export const keyOf = (kind) => ({ t: 'texts', m: 'marks', s: 'shapes', e: 'strokes' })[kind]
export const kindOf = (key) => LAYERS.find((l) => l.key === key).kind
export function layersOf(p) {
  const l = p?.layers || {}
  const order = (l.order && l.order.length === LAYERS.length) ? l.order : LAYERS.map((x) => x.key)
  return { order, hidden: l.hidden || {}, locked: l.locked || {} }
}
export const layerUsable = (p, key) => { const l = layersOf(p); return !l.hidden[key] && !l.locked[key] }

function normalizePlan(p) {
  const withId = (a) => (a || []).map((o) => (o.id ? o : { ...o, id: uid() }))
  return { ...p, marks: withId(p.marks), texts: withId(p.texts), shapes: withId(p.shapes), strokes: withId(p.strokes), layers: layersOf(p) }
}

/* ---------------- Store ---------------- */
const now = new Date()
export const useStore = window.__releve = create((set, get) => ({
  ready: false,
  plans: [],
  currentId: null,
  history: [],
  mode: 'mark',
  selected: null,          // {kind:'m'|'t'|'s', id}
  draftPathId: null,
  zoom: 1,
  sheetOpen: false,
  installEvt: null,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',

  xStyle: { color: '#e00000', size: 22, width: 4 },
  tStyle: { color: '#0f1f3d', size: 36, bold: true, bg: false },
  dStyle: { color: '#16a34a', width: 4, dash: false, fill: false, node: 6, arrow: false },
  eStyle: { width: 24 },
  textValue: '',

  hour: pad(now.getHours()),
  minute: '00',
  stamp: meta.get('stamp') !== '0',
  showCount: meta.get('showCount') !== '0',
  autoClear: meta.get('autoClear') === '1',
  setPref: (k, v) => { meta.set(k, v ? '1' : '0'); set({ [k]: v }) },
  fname: '',
  nameEdited: false,

  /* ---- getters ---- */
  plan: () => get().plans.find((p) => p.id === get().currentId) || null,
  selectedItem: () => {
    const { selected } = get(); const p = get().plan()
    if (!selected || !p) return null
    const arr = p[keyOf(selected.kind)] || []
    return arr.find((o) => o.id === selected.id) || null
  },

  /* ---- init ---- */
  init: async () => {
    await openDB()
    let plans = (await dbAll()).map(normalizePlan).sort((a, b) => (a.id < b.id ? -1 : 1))
    if (!import.meta.env.VITE_PUBLIC && !plans.length && (!db || !meta.get('init'))) {
      const demo = Object.values(import.meta.glob('./plan.png', { query: '?url', import: 'default' }))[0]
      if (demo) {
        const p = { id: uid(), name: 'Zone2', src: await demo(), marks: [], texts: [], shapes: [], strokes: [], layers: layersOf(null) }
        plans.push(p); dbPut(p); meta.set('init', '1')
      }
    }
    const last = meta.get('current')
    const currentId = plans.find((p) => p.id === last) ? last : plans[0]?.id || null
    set({ plans, currentId, ready: true })
    get().refreshName()
  },

  /* ---- plan management ---- */
  switchPlan: (id) => {
    if (get().draftPathId) get().finishPath()
    set({ currentId: id, history: [], selected: null, nameEdited: false })
    if (id) meta.set('current', id)
    get().refreshName()
  },
  addPlan: (name, src) => {
    const p = { id: uid(), name, src, marks: [], texts: [], shapes: [], strokes: [], layers: layersOf(null) }
    set({ plans: [...get().plans, p] }); dbPut(p); get().switchPlan(p.id)
    return p
  },
  renamePlan: (name) => { get().patchPlan((p) => ({ ...p, name }), false); set({ nameEdited: false }); get().refreshName() },
  deletePlan: () => {
    const id = get().currentId; dbDel(id)
    const plans = get().plans.filter((p) => p.id !== id)
    set({ plans }); get().switchPlan(plans[0]?.id || null)
  },
  cropPlan: (src, box) => {
    const inside = (o) => o.x >= 0 && o.y >= 0 && o.x <= box.w && o.y <= box.h
    get().patchPlan((p) => ({
      ...p, src,
      marks: p.marks.map((m) => ({ ...m, x: m.x - box.x, y: m.y - box.y })).filter(inside),
      texts: p.texts.map((t) => ({ ...t, x: t.x - box.x, y: t.y - box.y })).filter(inside),
      shapes: p.shapes.map((s) => translate(s, -box.x, -box.y)),
      strokes: p.strokes.map((s) => translate(s, -box.x, -box.y)),
    }))
  },

  /* ---- mutation helpers ---- */
  patchPlan: (fn, record = true) => {
    const p = get().plan(); if (!p) return
    if (record) get().snapshot()
    const np = fn(p)
    set({ plans: get().plans.map((x) => (x.id === p.id ? np : x)) })
    schedulePersist(np)
  },
  snapshot: () => {
    const p = get().plan(); if (!p) return
    const h = [...get().history, JSON.stringify({ marks: p.marks, texts: p.texts, shapes: p.shapes, strokes: p.strokes })]
    if (h.length > 200) h.shift()
    set({ history: h })
  },
  dropSnapshot: () => set({ history: get().history.slice(0, -1) }),
  undo: () => {
    if (get().draftPathId) get().finishPath()
    const h = get().history; if (!h.length) return false
    const s = JSON.parse(h[h.length - 1])
    set({ history: h.slice(0, -1), selected: null })
    get().patchPlan((p) => ({ ...p, ...s }), false)
    return true
  },
  updateItem: (kind, id, patch, record = false) => {
    const key = keyOf(kind)
    get().patchPlan((p) => ({ ...p, [key]: p[key].map((o) => (o.id === id ? (typeof patch === 'function' ? patch(o) : { ...o, ...patch }) : o)) }), record)
  },
  removeItem: (kind, id) => {
    const key = keyOf(kind)
    get().patchPlan((p) => ({ ...p, [key]: p[key].filter((o) => o.id !== id) }))
    if (get().selected?.id === id) set({ selected: null })
  },
  addItem: (kind, obj, record = true) => {
    const key = keyOf(kind)
    const o = { id: uid(), ...obj }
    get().patchPlan((p) => ({ ...p, [key]: [...p[key], o] }), record)
    return o
  },
  toggleLayer: (key, prop) => {
    get().patchPlan((p) => { const l = layersOf(p); return { ...p, layers: { ...l, [prop]: { ...l[prop], [key]: !l[prop][key] } } } }, false)
    const sel = get().selected; if (sel && keyOf(sel.kind) === key) set({ selected: null })
  },
  moveLayer: (key, dir) => get().patchPlan((p) => {
    const l = layersOf(p), o = [...l.order], i = o.indexOf(key), j = i + dir
    if (j < 0 || j >= o.length) return p
    ;[o[i], o[j]] = [o[j], o[i]]
    return { ...p, layers: { ...l, order: o } }
  }, false),
  clear: (keys) => get().patchPlan((p) => { const n = { ...p }; keys.forEach((k) => (n[k] = [])); return n }),

  /* ---- path drafting ---- */
  finishPath: () => {
    const id = get().draftPathId; if (!id) return
    set({ draftPathId: null })
    const p = get().plan(); const s = p?.shapes.find((o) => o.id === id); if (!s) return
    const pts = s.pts.filter((q, i, a) => i === 0 || Math.hypot(q.x - a[i - 1].x, q.y - a[i - 1].y) > 2)
    if (pts.length < 2) { get().patchPlan((pl) => ({ ...pl, shapes: pl.shapes.filter((o) => o.id !== id) }), false); get().dropSnapshot() }
    else get().updateItem('s', id, { pts })
  },

  /* ---- ui ---- */
  setMode: (mode) => { if (get().draftPathId && mode !== 'path') get().finishPath(); set({ mode, selected: null }) },
  select: (sel) => set({ selected: sel }),
  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(8, z)) }),
  toggleTheme: () => {
    const t = get().theme === 'dark' ? 'light' : 'dark'
    const el = document.documentElement
    el.classList.add('theme-anim'); el.classList.toggle('dark', t === 'dark')
    setTimeout(() => el.classList.remove('theme-anim'), 350)
    meta.set('theme', t); set({ theme: t })
  },

  /* style setters: met à jour le style par défaut ET l'élément sélectionné du même type */
  setStyle: (which, patch) => {
    set({ [which]: { ...get()[which], ...patch } })
    const sel = get().selected; if (!sel) return
    const kind = { xStyle: 'm', tStyle: 't', dStyle: 's' }[which]
    if (sel.kind !== kind) return
    get().updateItem(kind, sel.id, patch, false)
  },

  setHour: (hour, minute) => { set({ hour, minute, nameEdited: false }); get().refreshName() },
  setFname: (fname) => set({ fname, nameEdited: true }),
  refreshName: () => {
    if (get().nameEdited) return
    const p = get().plan()
    set({ fname: (p ? clean(p.name) + '_' : '') + get().hour + 'h' + get().minute })
  },
}))

export function translate(s, dx, dy) {
  if (s.type === 'rect') return { ...s, x: s.x + dx, y: s.y + dy }
  return { ...s, pts: s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
}

let persistT = null, pending = null
function schedulePersist(p) { pending = p; clearTimeout(persistT); persistT = setTimeout(() => { dbPut(pending); pending = null }, 80) }
window.addEventListener('pagehide', () => { if (pending) dbPut(pending) })

import { useRef } from 'react'
import * as DM from '@radix-ui/react-dropdown-menu'
import * as Select from '@radix-ui/react-select'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Check, ImagePlus, PencilLine, Crop, Trash2, Download, Moon, Sun, Map } from 'lucide-react'
import { useStore } from './store'
import { ask } from './dialogs'
import { Button, Tip, Kbd, cn } from './components/ui'
import { save } from './actions'
import logo from './logo.png'

export function PSign({ className, size = 'md' }) {
  return (
    <div className={cn('grid place-items-center rounded-[7px] bg-sign font-bold leading-none text-white shadow-[inset_0_0_0_2px_var(--sign),inset_0_0_0_3.5px_#fff]',
      size === 'md' ? 'size-8 text-[19px]' : 'size-14 text-[34px] rounded-[11px] shadow-[inset_0_0_0_3px_var(--sign),inset_0_0_0_5.5px_#fff]', className)}>P</div>
  )
}

const H = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const M = ['00', '15', '30', '45']

function TimeSelect({ value, items, onChange, id, label }) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger id={id} aria-label={label}
        className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[15px] font-semibold text-fg outline-none transition hover:bg-sunken data-[state=open]:bg-sunken">
        <Select.Value /><ChevronDown size={14} className="text-muted" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-50 max-h-72 min-w-16 overflow-hidden rounded-xl border border-line bg-raised p-1 text-fg shadow-float">
          <Select.Viewport>
            {items.map((v) => (
              <Select.Item key={v} value={v} className="flex h-8 cursor-pointer select-none items-center justify-between gap-3 rounded-md px-2.5 text-sm font-medium outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent data-[state=checked]:text-accent">
                <Select.ItemText>{v}</Select.ItemText>
                <Select.ItemIndicator><Check size={13} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

const itemCls = 'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-sunken data-[disabled]:opacity-40'

export default function TopBar() {
  const fileRef = useRef(null)
  const plans = useStore((s) => s.plans)
  const plan = useStore((s) => s.plan())
  const { hour, minute, setHour, fname, setFname, theme, toggleTheme } = useStore()

  async function onFile(e) {
    const f = e.target.files[0]; if (!f) return
    const src = await new Promise((r) => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(f) })
    const crop = await ask.crop({ src, title: 'Nouveau plan' }); if (!crop) return
    const base = f.name.replace(/\.[^.]+$/, '')
    const name = await ask.prompt({ title: 'Nom de la zone ou du parking', description: 'Il servira de début au nom des images enregistrées, par exemple « Parking_Nord_10h00.png ».', value: base, ok: 'Ajouter le plan' })
    if (name === null) return
    const p = useStore.getState().addPlan(name.trim() || base, crop.src)
    ask.toast(`Plan « ${p.name} » ajouté`)
  }
  async function rename() {
    const n = await ask.prompt({ title: 'Renommer la zone', description: 'Le nom sert de début au nom des images enregistrées.', value: plan.name, ok: 'Renommer' })
    if (n && n.trim()) useStore.getState().renamePlan(n.trim())
  }
  async function crop() {
    const c = await ask.crop({ src: plan.src, title: `Rogner « ${plan.name} »` })
    if (c && c.box) { useStore.getState().cropPlan(c.src, c.box); ask.toast('Plan rogné') }
  }
  async function del() {
    const ok = await ask.confirm({ title: `Supprimer « ${plan.name} » ?`, description: 'Le plan, ses X, ses textes et ses dessins seront supprimés définitivement.', ok: 'Supprimer le plan', danger: true })
    if (ok) useStore.getState().deletePlan()
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
      <div className="mr-2 flex items-center gap-3 pl-1">
        <img src={logo} alt="ITEC Mobility" className="h-8 w-auto select-none dark:rounded-md dark:bg-white dark:px-1.5 dark:py-1 dark:h-9" draggable={false} />
        <span className="hidden border-l border-line pl-3 text-[14px] font-medium text-fg-2 xl:inline"><span className="font-semibold text-fg">Occupa</span></span>
      </div>
      <div className="mx-1 h-6 w-px bg-line" />

      <DM.Root>
        <DM.Trigger asChild>
          <button id="planMenu" className="inline-flex h-9 max-w-64 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold outline-none transition hover:bg-sunken data-[state=open]:bg-sunken">
            <Map size={16} className="text-muted" />
            <span className="truncate">{plan ? plan.name : 'Aucun plan'}</span>
            <ChevronDown size={14} className="text-muted" />
          </button>
        </DM.Trigger>
        <DM.Portal>
          <DM.Content sideOffset={6} align="start" className="z-50 w-64 rounded-xl border border-line bg-raised p-1.5 text-fg shadow-float">
            {plans.length > 0 && <DM.Label className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted">Plans</DM.Label>}
            {plans.map((p) => (
              <DM.Item key={p.id} onSelect={() => useStore.getState().switchPlan(p.id)} className={itemCls}>
                <span className="size-4">{p.id === plan?.id && <Check size={16} className="text-accent" />}</span>
                <span className="truncate font-medium">{p.name}</span>
                <span className="ml-auto text-xs text-muted">{p.marks.length} X</span>
              </DM.Item>
            ))}
            {plans.length > 0 && <DM.Separator className="my-1.5 h-px bg-line" />}
            <DM.Item onSelect={() => fileRef.current.click()} className={itemCls}><ImagePlus size={16} className="text-muted" />Ajouter un plan…</DM.Item>
            <DM.Item disabled={!plan} onSelect={rename} className={itemCls}><PencilLine size={16} className="text-muted" />Renommer la zone</DM.Item>
            <DM.Item disabled={!plan} onSelect={crop} className={itemCls}><Crop size={16} className="text-muted" />Rogner le plan</DM.Item>
            <DM.Separator className="my-1.5 h-px bg-line" />
            <DM.Item disabled={!plan} onSelect={del} className={cn(itemCls, 'text-danger data-[highlighted]:bg-danger-soft')}><Trash2 size={16} />Supprimer le plan</DM.Item>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      <input ref={fileRef} id="file" type="file" accept="image/*" hidden onChange={(e) => { onFile(e); e.target.value = '' }} />

      <div className="mx-1 h-6 w-px bg-line" />
      <div className="flex items-center gap-0.5 rounded-lg pl-2">
        <span className="mr-1 text-sm text-muted">Relevé de</span>
        <TimeSelect id="hH" label="Heure" value={hour} items={H} onChange={(v) => setHour(v, minute)} />
        <span className="font-semibold text-muted">h</span>
        <TimeSelect id="hM" label="Minutes" value={minute} items={M} onChange={(v) => setHour(hour, v)} />
      </div>

      <div className="flex-1" />

      <label className="flex h-9 items-center rounded-lg border border-line-strong bg-surface pl-3 pr-2.5 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
        <input id="fname" value={fname} onChange={(e) => setFname(e.target.value)} aria-label="Nom du fichier"
          className="w-48 bg-transparent text-sm font-medium outline-none" />
        <span className="text-sm text-muted">.png</span>
      </label>
      <Tip label="Enregistrer l'image" kbd="Ctrl S">
        <Button id="save" variant="primary" onClick={save} disabled={!plan}><Download size={16} />Enregistrer</Button>
      </Tip>
      <Tip label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
        <Button id="theme" variant="ghost" size="icon" onClick={toggleTheme} aria-label="Changer de thème" className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ y: 14, opacity: 0, rotate: -40 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -14, opacity: 0, rotate: 40 }} transition={{ duration: 0.18 }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </Tip>
    </header>
  )
}

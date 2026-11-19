import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useStore } from './store'

createRoot(document.getElementById('root')).render(<App />)

// Application installable (uniquement servie en http/https, pas en fichier local)
if (location.protocol.startsWith('http')) {
  const link = document.createElement('link')
  link.rel = 'manifest'; link.href = 'manifest.webmanifest'
  document.head.appendChild(link)
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}))
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); useStore.setState({ installEvt: e }) })
window.addEventListener('appinstalled', () => useStore.setState({ installEvt: null }))

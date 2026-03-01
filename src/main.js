// Suppress SuperDoc's bundled Vue warning (it inlines its own Vue copy — unfixable)
const _warn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('compilerOptions')) return
  _warn.apply(console, args)
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import 'katex/dist/katex.min.css'

import { initTelemetry, setAppVersion } from './services/telemetry'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

initTelemetry()
setAppVersion(__APP_VERSION__)

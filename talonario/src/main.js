import './style.css'
import templateHtml from './template.html?raw'
import { initCalibration } from './calibration.js'
import { initData } from './data.js'
import { initEmpresas } from './empresas.js'

document.getElementById('app').innerHTML = templateHtml

// Orden importa: calibration envuelve las celdas en .cal-cell antes de que
// data renderice los valores dentro de ellas. Empresas depende de data.
initCalibration()
initData()
initEmpresas()
initShell()

// Shell del drawer: tabs, backdrop, Escape, focus trap y alternar vista.
function initShell() {
  const drawer = document.getElementById('drawer')
  const backdrop = document.getElementById('drawerBackdrop')
  const closeBtn = document.getElementById('drawerClose')
  const panels = {
    datos: document.getElementById('dataPanel'),
    cal: document.getElementById('calPanel')
  }
  const triggers = {
    datos: document.getElementById('dataToggle'),
    cal: document.getElementById('calToggle')
  }
  const tabs = Array.from(drawer.querySelectorAll('[role="tab"]'))
  let lastTrigger = null

  function setTab(name) {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
    })
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = key !== name
      panels[key].classList.toggle('open', key === name)
    })
    document.getElementById('drawerTitle').textContent =
      name === 'cal' ? 'Calibración' : 'Datos de impresión'
  }

  function open(name, trigger) {
    lastTrigger = trigger || triggers[name]
    setTab(name)
    drawer.classList.add('open')
    drawer.setAttribute('aria-hidden', 'false')
    document.body.classList.add('drawer-open')
    Object.keys(triggers).forEach((key) => {
      triggers[key].setAttribute('aria-expanded', String(key === name))
    })
    const target = panels[name].querySelector('input, textarea, select, button')
    if (target) target.focus({ preventScroll: true })
  }

  function close() {
    drawer.classList.remove('open')
    drawer.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('drawer-open')
    Object.values(triggers).forEach((t) => t.setAttribute('aria-expanded', 'false'))
    if (lastTrigger) {
      lastTrigger.focus({ preventScroll: true })
      lastTrigger = null
    }
  }

  triggers.datos.addEventListener('click', () => open('datos', triggers.datos))
  triggers.cal.addEventListener('click', () => open('cal', triggers.cal))
  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', close)

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab))
    tab.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return
      ev.preventDefault()
      const i = tabs.indexOf(tab)
      const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
      setTab(next.dataset.tab)
      next.focus()
    })
  })

  document.addEventListener('keydown', (ev) => {
    if (!drawer.classList.contains('open')) return
    if (ev.key === 'Escape') {
      close()
      return
    }
    if (ev.key !== 'Tab') return
    const list = Array.from(
      drawer.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null)
    if (!list.length) return
    const first = list[0]
    const last = list[list.length - 1]
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault()
      last.focus()
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault()
      first.focus()
    }
  })

  const viewToggle = document.getElementById('viewToggle')
  viewToggle.addEventListener('click', () => {
    const on = document.body.classList.toggle('preview-print-only')
    viewToggle.setAttribute('aria-pressed', String(on))
  })

  document.getElementById('appPrint').addEventListener('click', () => window.print())
}

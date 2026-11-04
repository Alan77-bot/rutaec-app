import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const abiertos = []
let overflowAnterior = ''

/** Contenedor único para los diálogos de todos los roles. Conserva sus formularios y acciones. */
export default function Dialogo({ overlayProps = {}, panelProps = {}, children }) {
  const panel = useRef(null)
  useEffect(() => {
    const elemento = panel.current
    const anterior = document.activeElement
    if (!abiertos.length) {
      overflowAnterior = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    abiertos.push(elemento)
    // Oficinistas ya conserva foco y teclado mediante su referencia existente.
    const gestionarFoco = !panelProps.ref
    const controles = () => Array.from(elemento.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => !el.hidden && el.getClientRects().length)
    if (gestionarFoco) (controles()[0] || elemento).focus()
    const teclado = evento => {
      if (abiertos.at(-1) !== elemento || !gestionarFoco) return
      if (evento.key === 'Escape') {
        const cerrar = elemento.querySelector('button[aria-label^="Cerrar"],button.modal-x,button.modal-cerrar,button.gm-cerrar,button.of-modal-cerrar') || Array.from(elemento.querySelectorAll('button')).find(b => /^(Cancelar|Cerrar|Volver)$/.test(b.textContent.trim()))
        if (cerrar && !cerrar.disabled) { evento.preventDefault(); cerrar.click() }
      }
      if (evento.key === 'Tab') {
        const lista = controles()
        if (!lista.length) { evento.preventDefault(); elemento.focus(); return }
        const primero = lista[0], ultimo = lista.at(-1)
        if (!elemento.contains(document.activeElement) || (evento.shiftKey && document.activeElement === primero)) { evento.preventDefault(); (evento.shiftKey ? ultimo : primero).focus() }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus() }
      }
    }
    document.addEventListener('keydown', teclado)
    return () => {
      document.removeEventListener('keydown', teclado)
      const indice = abiertos.indexOf(elemento)
      if (indice !== -1) abiertos.splice(indice, 1)
      if (!abiertos.length) document.body.style.overflow = overflowAnterior
      if (gestionarFoco && anterior instanceof HTMLElement && anterior.isConnected) anterior.focus()
    }
  }, [])
  const contenido = <div {...overlayProps} className={`ui-dialogo-fondo ${overlayProps.className || ''}`}>
    <section {...panelProps} ref={elemento => {
      panel.current = elemento
      if (typeof panelProps.ref === 'function') panelProps.ref(elemento)
      else if (panelProps.ref) panelProps.ref.current = elemento
    }} className={`ui-dialogo ${panelProps.className || ''}`} role={panelProps.role || 'dialog'} aria-modal="true" aria-label={panelProps['aria-label'] || (!panelProps['aria-labelledby'] ? 'Información' : undefined)} tabIndex={-1}>
      {children}
    </section>
  </div>
  const destino = typeof document !== 'undefined' ? document.querySelector('.tema-cooperativa') || document.getElementById('root') : null
  return destino ? createPortal(contenido, destino) : contenido
}

import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { useCounts } from '../lib/hooks'

/**
 * Feedback de SO durante/после un run: barra de progreso en el icono de la taskbar
 * (como compilar en VS / copiar ficheros) y notificación al terminar. No pinta nada.
 */
export function RunFeedback() {
  const phase = useStore((s) => s.phase)
  const phaseMessage = useStore((s) => s.phaseMessage)
  const runTotal = useStore((s) => s.runTotal)
  const c = useCounts()
  const prev = useRef(phase)

  const done = c.passed + c.failed + c.skipped
  const denom = runTotal > 0 ? runTotal : c.total

  // Progreso en la taskbar.
  useEffect(() => {
    if (phase === 'preparing' || phase === 'building' || phase === 'discovering') {
      window.engine.setProgress({ mode: 'indeterminate' })
    } else if (phase === 'running') {
      window.engine.setProgress({ mode: 'normal', value: denom ? done / denom : 0 })
    } else {
      window.engine.setProgress({ mode: 'none' })
    }
  }, [phase, done, denom])

  // Notificación SOLO al terminar un run (la fase previa era 'running'); un explore no notifica.
  useEffect(() => {
    const was = prev.current
    prev.current = phase
    if (was !== 'running') return
    if (phase === 'completed') {
      const ok = c.failed === 0
      window.engine.notify({
        title: ok ? '✓ Tests passed' : '✗ Tests failed',
        body: `✓ ${c.passed}   ✗ ${c.failed}   ⊘ ${c.skipped}   ·   ${denom} tests`,
      })
    } else if (phase === 'failed' && !/cancel/i.test(phaseMessage)) {
      window.engine.notify({ title: '✗ Run failed', body: phaseMessage || 'The run failed.' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return null
}

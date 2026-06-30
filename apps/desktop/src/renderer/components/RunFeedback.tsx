import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { useCounts } from '../lib/hooks'

/** Genera una insignia circular (32x32) para el overlay del icono de la taskbar. */
function badge(kind: 'run' | 'pass' | 'fail'): string {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const x = c.getContext('2d')!
  x.beginPath()
  x.arc(16, 16, 15, 0, Math.PI * 2)
  x.fillStyle = kind === 'pass' ? '#2faa5a' : kind === 'fail' ? '#d23b3b' : '#3b82f6'
  x.fill()
  x.strokeStyle = 'rgba(0,0,0,0.25)'
  x.lineWidth = 1
  x.stroke()
  x.strokeStyle = '#fff'
  x.lineCap = 'round'
  x.lineJoin = 'round'
  x.lineWidth = 3.5
  x.beginPath()
  if (kind === 'pass') {
    x.moveTo(9, 16.5); x.lineTo(14, 21.5); x.lineTo(23.5, 10.5)
  } else if (kind === 'fail') {
    x.moveTo(11, 11); x.lineTo(21, 21); x.moveTo(21, 11); x.lineTo(11, 21)
  } else {
    x.moveTo(9.5, 16); x.lineTo(9.5, 16); x.moveTo(16, 16); x.lineTo(16, 16); x.moveTo(22.5, 16); x.lineTo(22.5, 16)
    x.lineWidth = 4
  }
  x.stroke()
  return c.toDataURL('image/png')
}

/**
 * Feedback de SO: barra de progreso en el icono de la taskbar (live, incluso minimizada),
 * insignia de estado (✓/✗/corriendo) en el icono, recorte del preview a la barra de estado
 * mientras corre, y notificación al terminar. No pinta nada en la ventana.
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

  // Insignia + recorte del preview + notificación, en las transiciones de fase.
  useEffect(() => {
    const was = prev.current
    prev.current = phase

    if (phase === 'running') {
      window.engine.setOverlay({ dataUrl: badge('run'), description: 'Running tests…' })
      const sb = document.querySelector('.statusbar') as HTMLElement | null
      if (sb) {
        const r = sb.getBoundingClientRect()
        window.engine.setThumbClip({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) })
      }
      return
    }

    // Fuera de 'running': quita el recorte (preview = ventana completa).
    window.engine.setThumbClip(null)

    if (was === 'running' && phase === 'completed') {
      const ok = c.failed === 0
      window.engine.setOverlay({ dataUrl: badge(ok ? 'pass' : 'fail'), description: `✓ ${c.passed}  ✗ ${c.failed}  ⊘ ${c.skipped}` })
      window.engine.notify({
        title: ok ? '✓ Tests passed' : '✗ Tests failed',
        body: `✓ ${c.passed}   ✗ ${c.failed}   ⊘ ${c.skipped}   ·   ${denom} tests`,
      })
    } else if (was === 'running' && phase === 'failed' && !/cancel/i.test(phaseMessage)) {
      window.engine.setOverlay({ dataUrl: badge('fail'), description: 'Run failed' })
      window.engine.notify({ title: '✗ Run failed', body: phaseMessage || 'The run failed.' })
    } else if (phase === 'building' || phase === 'preparing' || phase === 'discovering' || phase === 'idle') {
      // Nuevo run/explore o reset: limpia la insignia anterior.
      window.engine.setOverlay({ dataUrl: null, description: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return null
}

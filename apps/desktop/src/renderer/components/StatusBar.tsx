import { useStore } from '../store'
import { useCounts, useVisibleCount } from '../lib/hooks'

export function StatusBar() {
  const s = useStore()
  const c = useCounts()
  const visible = useVisibleCount()
  const elapsed = s.startedAt ? ((s.finishedAt ?? Date.now()) - s.startedAt) / 1000 : 0
  // El progreso es relativo a lo que abarca el run (lo lanzado), no al total del árbol.
  const denom = s.runTotal > 0 ? s.runTotal : c.total
  const pct = (n: number) => (denom ? (n / denom) * 100 : 0)
  const done = c.passed + c.failed + c.skipped
  const labelFor = (p: string): string => {
    switch (p) {
      case 'idle':
        return 'ready'
      case 'failed':
        return 'error'
      case 'completed':
        if (done === 0 && c.total > 0) return 'explored'
        return c.failed > 0 ? 'failed' : 'passed'
      default:
        return p
    }
  }
  return (
    <div className="statusbar">
      <span className={'phase phase-' + s.phase}>{labelFor(s.phase)}</span>
      {s.phaseMessage && <span className="muted st-msg">{s.phaseMessage}</span>}
      <span className="st-spacer" />
      <div className="bar">
        <span className="bar-pass" style={{ width: pct(c.passed) + '%' }} />
        <span className="bar-fail" style={{ width: pct(c.failed) + '%' }} />
        <span className="bar-skip" style={{ width: pct(c.skipped) + '%' }} />
      </div>
      <span className="cnt pass">✓ {c.passed}</span>
      <span className="cnt fail">✗ {c.failed}</span>
      <span className="cnt skip">⊘ {c.skipped}</span>
      <span className="muted">
        {c.total} tests
        {visible !== c.total ? ` · ${visible} shown` : ''} · ⏱ {elapsed.toFixed(1)}s
      </span>
    </div>
  )
}

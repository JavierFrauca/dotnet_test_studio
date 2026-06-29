import { useStore } from '../store'

/** Modal de "ocupado": cargando proyectos / preparando worktree / compilando / descubriendo.
 *  Durante 'running' NO se muestra: el árbol se colorea en vivo y es navegable. */
export function LoadingOverlay() {
  const phase = useStore((s) => s.phase)
  const msg = useStore((s) => s.phaseMessage)
  const loadingProjects = useStore((s) => s.loadingProjects)
  const wtBusy = useStore((s) => s.wtBusy)
  const cancel = useStore((s) => s.cancel)
  const logs = useStore((s) => s.logs)

  const busy = loadingProjects || wtBusy || phase === 'preparing' || phase === 'building' || phase === 'discovering'
  if (!busy) return null

  const label = wtBusy
    ? 'Creating isolated worktree…'
    : loadingProjects
      ? 'Loading projects…'
      : phase === 'preparing'
        ? 'Preparing isolated worktree…'
        : phase === 'building'
          ? 'Building…'
          : 'Discovering tests…'

  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null

  return (
    <div className="overlay">
      <div className="modal">
        <div className="spinner" />
        <div className="overlay-label">{label}</div>
        {!loadingProjects && msg && <div className="overlay-sub">{msg}</div>}
        {(phase === 'building' || wtBusy) && lastLog && <div className="overlay-log mono">{lastLog}</div>}
        {!loadingProjects && !wtBusy && (
          <button className="btn btn-danger" onClick={() => cancel()}>
            ■ Cancel
          </button>
        )}
      </div>
    </div>
  )
}

/** Modal de error de compilación/preparación: extrae las líneas de error del log. */
export function ErrorOverlay() {
  const phase = useStore((s) => s.phase)
  const msg = useStore((s) => s.phaseMessage)
  const logs = useStore((s) => s.logs)
  const dismiss = useStore((s) => s.dismissError)
  if (phase !== 'failed') return null

  const errorLines = logs.filter((l) => /(?::\s*error|\berror\s+[A-Z]{1,3}\d{2,5}\b|\berror\b)/i.test(l))
  const shown = (errorLines.length > 0 ? errorLines : logs).slice(-12)

  return (
    <div className="overlay">
      <div className="modal modal-error">
        <div className="modal-error-head">
          <i className="ti ti-alert-triangle" />
          <span>{msg || 'Something went wrong'}</span>
        </div>
        {shown.length > 0 && <pre className="modal-error-body mono">{shown.join('\n')}</pre>}
        <div className="muted small">Tests were not run because of the error above.</div>
        <button className="btn" onClick={() => dismiss()}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/** Toggle "isolated" + menú desplegable para crear/recrear/destruir el worktree persistente. */
export function IsolatedControl() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const ready = s.wtStatus === 'ready'
  const matches = ready && s.wtBranch === s.selectedBranch
  const dot = !s.useWorktree ? '' : !ready ? 'dot-none' : !matches || s.wtOutdated ? 'dot-warn' : 'dot-ok'

  return (
    <div className="iso" ref={ref}>
      <label className={'chip iso-chip' + (s.useWorktree ? ' chip-on' : '')} title="Run in an isolated worktree (created once, reused)">
        <input type="checkbox" checked={s.useWorktree} onChange={(e) => s.setConfig({ useWorktree: e.target.checked })} />
        isolated
        {s.useWorktree && <span className={'iso-dot ' + dot} />}
      </label>
      <button className="iso-caret" disabled={!s.useWorktree} onClick={() => setOpen((o) => !o)}>
        ▾
      </button>
      {open && (
        <div className="iso-menu">
          <div className="iso-status">
            {ready ? (
              <>
                Worktree: <b>{s.wtBranch}</b> · {s.wtHead}
                {s.wtOutdated && <span className="warn"> · outdated</span>}
                {!matches && <span className="warn"> · ≠ {s.selectedBranch}</span>}
              </>
            ) : (
              'No worktree created'
            )}
          </div>
          {s.wtError && <div className="iso-err">{s.wtError}</div>}
          <button
            className="iso-item"
            disabled={!s.solution || !s.selectedBranch || s.wtBusy}
            onClick={() => {
              setOpen(false)
              void s.createWorktree()
            }}
          >
            <i className="ti ti-plus" /> {ready ? 'Recreate' : 'Create'} for {s.selectedBranch ?? '—'}
          </button>
          <button className="iso-item" disabled={!ready || s.wtBusy} onClick={() => { setOpen(false); void s.destroyWorktree() }}>
            <i className="ti ti-trash" /> Destroy worktree
          </button>
        </div>
      )}
    </div>
  )
}

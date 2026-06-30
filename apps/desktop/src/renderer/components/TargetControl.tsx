import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/**
 * Control unificado de "qué testeo y cómo": working copy (tu checkout) vs isolated worktree.
 * La rama vive dentro de cada modo. Seleccionar NUNCA actúa: las acciones (Switch checkout /
 * Create / Destroy) son explícitas.
 */
export function TargetControl() {
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

  const current = s.solution?.branch ?? null
  const wtReady = s.wtStatus === 'ready'
  const wtMatch = wtReady && s.wtBranch === s.selectedBranch
  const dot = !wtReady ? 'dot-none' : !wtMatch || s.wtOutdated ? 'dot-warn' : 'dot-ok'

  const label = s.useWorktree ? `isolated · ${s.selectedBranch ?? '—'}` : (current ?? 'working copy')

  return (
    <div className="target" ref={ref}>
      <button className="target-btn" disabled={!s.solution} onClick={() => setOpen((o) => !o)} title="Test target">
        <i className={'ti ' + (s.useWorktree ? 'ti-git-fork' : 'ti-git-branch')} />
        <span className="target-label">{label}</span>
        {s.useWorktree && <span className={'iso-dot ' + dot} />}
        <i className="ti ti-chevron-down caret" />
      </button>

      {open && (
        <div className="target-menu">
          {/* Working copy */}
          <label className={'target-mode' + (!s.useWorktree ? ' on' : '')}>
            <input type="radio" name="target-mode" checked={!s.useWorktree} onChange={() => s.setConfig({ useWorktree: false })} />
            <div className="tm-body">
              <div className="tm-title">
                <i className="ti ti-git-branch" /> Working copy
              </div>
              <div className="tm-sub">
                {current ? (
                  <>
                    on <b>{current}</b> — your checkout
                  </>
                ) : (
                  'your checkout'
                )}
                {s.workingDirty && <span className="warn"> · uncommitted changes</span>}
              </div>
              {!s.useWorktree && (
                <div className="tm-action">
                  <span className="muted small">switch to</span>
                  <select
                    className="select narrow"
                    value=""
                    disabled={s.branches.length === 0}
                    onChange={(e) => {
                      if (e.target.value) s.selectBranch(e.target.value)
                    }}
                  >
                    <option value="">branch…</option>
                    {s.branches.filter((b) => b !== current).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <span className="muted small">(git checkout)</span>
                </div>
              )}
            </div>
          </label>

          <div className="target-sep" />

          {/* Isolated worktree */}
          <label className={'target-mode' + (s.useWorktree ? ' on' : '')}>
            <input type="radio" name="target-mode" checked={s.useWorktree} onChange={() => s.setConfig({ useWorktree: true })} />
            <div className="tm-body">
              <div className="tm-title">
                <i className="ti ti-git-fork" /> Isolated worktree <span className="muted small">· doesn’t touch your checkout</span>
              </div>
              {s.useWorktree && (
                <>
                  <div className="tm-action">
                    <span className="muted small">branch</span>
                    <select
                      className="select narrow"
                      value={s.selectedBranch ?? ''}
                      disabled={s.branches.length === 0}
                      onChange={(e) => s.selectBranch(e.target.value)}
                    >
                      {s.branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tm-status">
                    {wtReady ? (
                      <>
                        <span className={'iso-dot ' + dot} /> ready · {s.wtHead}
                        {s.wtOutdated && <span className="warn"> · outdated</span>}
                        {!wtMatch && <span className="warn"> · ≠ {s.selectedBranch}</span>}
                      </>
                    ) : (
                      <>
                        <span className="iso-dot dot-none" /> not created
                      </>
                    )}
                  </div>
                  {s.wtError && <div className="iso-err">{s.wtError}</div>}
                  <div className="tm-actions">
                    <button className="btn small" disabled={!s.selectedBranch || s.wtBusy} onClick={() => void s.createWorktree()}>
                      <i className="ti ti-plus" /> {wtReady ? 'Recreate' : 'Create'}
                    </button>
                    <button className="btn small" disabled={!wtReady || s.wtBusy} onClick={() => void s.destroyWorktree()}>
                      <i className="ti ti-trash" /> Destroy
                    </button>
                  </div>
                </>
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  )
}

import { useStore } from '../store'

const STATUS_LABEL: Record<string, string> = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed' }

/** Modal: ficheros cambiados vs la rama base (global, no por test). */
export function GlobalChanges() {
  const open = useStore((s) => s.changesOpen)
  const files = useStore((s) => s.changesFiles)
  const base = useStore((s) => s.changesBase)
  const loading = useStore((s) => s.changesLoading)
  const branches = useStore((s) => s.branches)
  const gitBase = useStore((s) => s.gitBase)
  const setGitBase = useStore((s) => s.setGitBase)
  const close = useStore((s) => s.closeChanges)

  if (!open) return null

  return (
    <div className="overlay overlay-top" onMouseDown={() => close()}>
      <div className="modal modal-changes" onMouseDown={(e) => e.stopPropagation()}>
        <div className="changes-head">
          <div className="confirm-title">
            <i className="ti ti-git-compare" /> Changes vs base
          </div>
          <div className="changes-base">
            <span className="muted small">base</span>
            <select className="select narrow" value={gitBase ?? ''} onChange={(e) => setGitBase(e.target.value || null)}>
              <option value="">{base ? `auto (${base})` : 'auto'}</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button className="iconbtn" title="Close" onClick={() => close()}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        {loading && <div className="muted small">Loading…</div>}
        {!loading && files.length === 0 && (
          <div className="muted small">No changes vs {base ?? 'base'} (or not a git repo).</div>
        )}
        {!loading && files.length > 0 && (
          <>
            <div className="muted small">
              {files.length} file(s) changed vs <span className="text-accent">{base ?? '—'}</span>
            </div>
            <div className="changes-list">
              {files.map((f) => (
                <button
                  key={f.path}
                  className="changes-row"
                  title="Open in editor"
                  onClick={() => window.engine.openInEditor({ file: f.abs })}
                >
                  <span className={'chg-status chg-' + f.status}>{STATUS_LABEL[f.status] ?? f.status}</span>
                  <span className="mono chg-path">{f.path}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

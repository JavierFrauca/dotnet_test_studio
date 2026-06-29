import { useEffect } from 'react'
import { useStore, type GitFrame, type TestLeaf } from '../store'

/** Pestaña "Changes vs base": cruza el stack del fallo con el diff vs la rama base. */
export function GitChanges({ leaf }: { leaf: TestLeaf }) {
  const load = useStore((s) => s.loadTestGitContext)
  const ctx = useStore((s) => s.gitContext)
  const ctxFqn = useStore((s) => s.gitContextFqn)
  const loading = useStore((s) => s.loadingGit)
  const branches = useStore((s) => s.branches)
  const gitBase = useStore((s) => s.gitBase)
  const setGitBase = useStore((s) => s.setGitBase)

  useEffect(() => {
    void load(leaf.fqn, leaf.stack ?? null)
  }, [leaf.fqn, leaf.stack, gitBase, load])

  const ready = ctx && ctxFqn === leaf.fqn
  const changedCount = ready ? ctx!.frames.filter((f) => f.changed).length : 0

  return (
    <div className="git">
      <div className="git-head">
        <span className="muted small">base</span>
        <select className="select narrow" value={gitBase ?? ''} onChange={(e) => setGitBase(e.target.value || null)}>
          <option value="">{ready && ctx!.base ? `auto (${ctx!.base})` : 'auto'}</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="muted small">Loading changes…</div>}
      {!loading && ready && !ctx!.isRepo && <div className="muted small">Not a git repository.</div>}
      {!loading && ready && ctx!.isRepo && ctx!.frames.length === 0 && (
        <div className="muted small">No source files found in the stack trace (debug build needed).</div>
      )}
      {!loading && ready && ctx!.isRepo && ctx!.frames.length > 0 && (
        <>
          <div className="muted small git-summary">
            <i className="ti ti-bulb" /> {changedCount} of {ctx!.frames.length} files in the stack changed vs{' '}
            <span className="text-accent">{ctx!.base ?? '—'}</span>
          </div>
          {[...ctx!.frames].sort((a, b) => Number(b.changed) - Number(a.changed)).map((f, i) => (
            <GitFrameView key={i} frame={f} />
          ))}
        </>
      )}
    </div>
  )
}

function GitFrameView({ frame }: { frame: GitFrame }) {
  const short = frame.relPath ?? frame.file
  if (!frame.changed) {
    return (
      <div className="git-frame">
        <i className="ti ti-file" /> <span className="mono">{short}:{frame.line}</span>
        <span className="git-tag muted">unchanged</span>
      </div>
    )
  }
  return (
    <div className="git-frame changed">
      <div className="git-frame-head">
        <i className="ti ti-file-diff" /> <span className="mono fail">{short}:{frame.line}</span>
        {frame.blame?.onBranch && <span className="git-tag warn">changed on this branch</span>}
      </div>
      {frame.diff && <DiffHunk diff={frame.diff} />}
      {frame.blame && (
        <div className="git-blame">
          <i className="ti ti-git-commit" /> <span className="mono">{frame.blame.commit}</span> · {frame.blame.author}
          {frame.blame.date ? ' · ' + frame.blame.date : ''}
          {frame.blame.summary ? ' · ' + frame.blame.summary : ''}
        </div>
      )}
    </div>
  )
}

function DiffHunk({ diff }: { diff: string }) {
  const lines = diff
    .split('\n')
    .filter((l) => !l.startsWith('diff --git') && !l.startsWith('index ') && !l.startsWith('--- ') && !l.startsWith('+++ '))
    .slice(0, 40)
  return (
    <pre className="diff">
      {lines.map((l, i) => {
        const cls = l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : l.startsWith('@@') ? 'hunk' : ''
        return (
          <div key={i} className={'diff-line ' + cls}>
            {l || ' '}
          </div>
        )
      })}
    </pre>
  )
}

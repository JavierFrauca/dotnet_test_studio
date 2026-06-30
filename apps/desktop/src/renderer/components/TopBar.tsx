import { useStore } from '../store'
import { useCounts, useVisibleCount } from '../lib/hooks'
import { IsolatedControl } from './IsolatedControl'

export function TopBar() {
  const s = useStore()
  const visibleCount = useVisibleCount()
  const c = useCounts()
  const wtReady = !s.useWorktree || (s.wtStatus === 'ready' && s.wtBranch === s.selectedBranch)
  const running = s.phase === 'preparing' || s.phase === 'building' || s.phase === 'discovering' || s.phase === 'running'
  const isRunning = s.phase === 'running'
  return (
    <div className="toolbar">
      <button className="btn" onClick={() => void s.openFolder()}>
        <span className="i">▣</span>
        {s.solution ? s.solution.project : 'Open folder…'}
      </button>

      <select
        className="select"
        disabled={!s.solution || s.branches.length === 0}
        value={s.selectedBranch ?? ''}
        onChange={(e) => s.selectBranch(e.target.value)}
        title={s.useWorktree ? 'Target branch for the isolated worktree' : 'Switch branch (checks out your working copy)'}
      >
        {s.branches.map((b) => (
          <option key={b} value={b}>
            ⎇ {b}
          </option>
        ))}
      </select>

      <IsolatedControl />

      <select className="select narrow" value={s.configuration} onChange={(e) => s.setConfig({ configuration: e.target.value })}>
        <option>Debug</option>
        <option>Release</option>
      </select>

      {isRunning ? (
        <span className="running-inline">
          <span className="mini-spinner" />
          <span className="muted">running</span>
          <span className="cnt pass">✓ {c.passed}</span>
          <span className="cnt fail">✗ {c.failed}</span>
          <span className="cnt skip">⊘ {c.skipped}</span>
          <span className="muted">{c.passed + c.failed + c.skipped}/{c.total}</span>
          <button className="btn btn-danger" onClick={() => s.cancel()}>
            ■ Cancel
          </button>
        </span>
      ) : (
        <>
          <button
            className={'btn' + (s.stale ? ' btn-attn' : '')}
            disabled={running || !s.solution || !wtReady || (s.testProjects.length > 0 && s.selectedProjects.length === 0)}
            onClick={() => void s.discover()}
            title={
              !wtReady
                ? `Create the isolated worktree for ${s.selectedBranch} first`
                : s.stale
                  ? 'Selection changed — explore again to refresh the list'
                  : 'Build and list tests without running them (to filter before launching)'
            }
          >
            <span className="i">⌕</span> Explore{s.stale ? ' •' : ''}
          </button>
          <button
            className="btn btn-primary"
            disabled={running || !wtReady || !s.explored || s.stale || visibleCount === 0}
            title={
              !wtReady
                ? `Create the isolated worktree for ${s.selectedBranch} first`
                : !s.explored
                  ? 'Explore first to list the tests'
                  : s.stale
                    ? 'Selection changed — explore again before running'
                    : visibleCount === 0
                      ? 'No visible tests to run'
                      : `Run ${visibleCount} visible test(s)`
            }
            onClick={() => void s.run()}
          >
            ▶ Run tests
          </button>
        </>
      )}
    </div>
  )
}

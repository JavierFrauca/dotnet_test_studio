import { useStore } from '../store'
import { useCounts, useVisibleCount } from '../lib/hooks'
import { TargetControl } from './TargetControl'

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

      <TargetControl />

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

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

      <button className="btn" disabled={!s.solution} onClick={() => s.openChanges()} title="Changed files vs base branch">
        <i className="ti ti-git-compare" /> Changes
      </button>

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
            disabled={
              running ||
              !wtReady ||
              !s.solution ||
              (s.testProjects.length > 0 && s.selectedProjects.length === 0) ||
              (s.explored && !s.stale && visibleCount === 0)
            }
            title={
              !wtReady
                ? `Create the isolated worktree for ${s.selectedBranch} first`
                : !s.explored || s.stale
                  ? 'Build, list and run the tests'
                  : visibleCount === 0
                    ? 'No visible tests to run'
                    : `Run ${visibleCount} visible test(s)`
            }
            onClick={() => void s.runAll()}
          >
            ▶ Run tests
          </button>
          {s.explored && !s.stale && c.failed > 0 && (
            <button
              className="btn btn-rerun"
              title={`Re-run only the ${c.failed} failed test(s)`}
              onClick={() => void s.rerunFailed()}
            >
              ↻ Re-run failed ({c.failed})
            </button>
          )}
        </>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useStore, type TestLeaf } from '../store'
import { findLeaf, STATUS_ICON } from '../lib/ui'
import { GitChanges } from './GitChanges'

export function Detail() {
  const selectedKey = useStore((s) => s.selectedKey)
  const tree = useStore((s) => s.tree)
  const logs = useStore((s) => s.logs)
  const leaf = useMemo(() => findLeaf(selectedKey), [selectedKey, tree])

  if (!leaf) {
    return (
      <div className="detail">
        <div className="detail-title muted">Log</div>
        <pre className="logs">{logs.slice(-30).join('\n') || '(select a test to see details)'}</pre>
      </div>
    )
  }

  return <DetailFor leaf={leaf} />
}

function DetailFor({ leaf }: { leaf: TestLeaf }) {
  const [tab, setTab] = useState<'details' | 'changes'>('details')
  const canGit = leaf.status === 'failed'
  const active = canGit ? tab : 'details'

  return (
    <div className="detail">
      <div className={'detail-title ' + leaf.status}>
        {STATUS_ICON[leaf.status]} {leaf.name}
      </div>
      <div className="fqn">{leaf.fqn}</div>

      {canGit && (
        <div className="detail-tabs">
          <button className={'dtab' + (active === 'details' ? ' on' : '')} onClick={() => setTab('details')}>
            Details
          </button>
          <button className={'dtab' + (active === 'changes' ? ' on' : '')} onClick={() => setTab('changes')}>
            <i className="ti ti-git-compare" /> Changes vs base
          </button>
        </div>
      )}

      {active === 'details' && (
        <>
          <div className="muted small">Duration: {Math.round(leaf.durationMs)} ms</div>
          {leaf.status === 'failed' && leaf.error && (
            <>
              <div className="detail-label fail">Message</div>
              <pre className="msg fail">{leaf.error}</pre>
            </>
          )}
          {leaf.status === 'failed' && leaf.stack && (
            <>
              <div className="detail-label warn">Stack trace</div>
              <pre className="stack">{leaf.stack}</pre>
            </>
          )}
          {leaf.status === 'passed' && <div className="ok">Test passed.</div>}
          {leaf.status === 'skipped' && <div className="warn">Test skipped.</div>}
        </>
      )}

      {active === 'changes' && <GitChanges leaf={leaf} />}
    </div>
  )
}

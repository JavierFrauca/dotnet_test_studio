import { useEffect, useMemo, useState } from 'react'
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

/** Extrae Expected/Actual del mensaje de aserción (xUnit y similares). */
function parseExpectedActual(msg: string): { expected: string; actual: string } | null {
  const e = msg.match(/Expected:\s*(.+)/i)
  const a = msg.match(/Actual:\s*(.+)/i)
  if (e && a) return { expected: e[1].trim(), actual: a[1].trim() }
  return null
}

const LOC = /\s(?:in|en)\s+(.+?):(?:line|l[ií]nea)\s+(\d+)/i

function DetailFor({ leaf }: { leaf: TestLeaf }) {
  const [tab, setTab] = useState<'details' | 'changes'>('details')
  const failureSrc = useStore((s) => s.failureSrc)
  const loadFailureSource = useStore((s) => s.loadFailureSource)
  const wasPassing = useStore((s) => s.prevStatus[leaf.fqn] === 'passed')
  const wasFailing = useStore((s) => s.prevStatus[leaf.fqn] === 'failed')

  const canGit = leaf.status === 'failed'
  const active = canGit ? tab : 'details'

  // Carga el snippet del punto del fallo al seleccionar un test fallido.
  useEffect(() => {
    if (leaf.status === 'failed' && leaf.stack) void loadFailureSource(leaf.fqn, leaf.stack)
  }, [leaf.fqn, leaf.stack, leaf.status, loadFailureSource])

  const ea = leaf.status === 'failed' && leaf.error ? parseExpectedActual(leaf.error) : null
  const snippet = failureSrc && failureSrc.fqn === leaf.fqn ? failureSrc : null

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
          {/* #6 — regresión / arreglado respecto al run anterior */}
          {leaf.status === 'failed' && wasPassing && (
            <div className="regress">
              <i className="ti ti-alert-triangle" /> Was <b>passing</b> in the previous run — likely broken by a recent change.
            </div>
          )}
          {leaf.status === 'passed' && wasFailing && (
            <div className="fixed-note">
              <i className="ti ti-check" /> Was failing in the previous run — now fixed.
            </div>
          )}

          <div className="muted small">Duration: {Math.round(leaf.durationMs)} ms</div>

          {/* #2 — expected vs actual */}
          {ea && (
            <div className="ea">
              <div className="ea-row ea-exp">
                <span className="ea-tag">expected</span>
                <span className="mono">{ea.expected}</span>
              </div>
              <div className="ea-row ea-act">
                <span className="ea-tag">actual</span>
                <span className="mono">{ea.actual}</span>
              </div>
            </div>
          )}

          {leaf.status === 'failed' && leaf.error && (
            <>
              <div className="detail-label fail">Message</div>
              <pre className="msg fail">{leaf.error}</pre>
            </>
          )}

          {/* #1 — snippet de código en el punto del fallo */}
          {snippet && (
            <>
              <div className="detail-label">
                At{' '}
                <button className="link-loc mono" onClick={() => window.engine.openInEditor({ file: snippet.file, line: snippet.line })} title="Open in editor">
                  {snippet.relPath ?? snippet.file}:{snippet.line}
                </button>
              </div>
              <pre className="snippet">
                {snippet.lines.map((ln, i) => {
                  const n = snippet.startLine + i
                  return (
                    <div key={n} className={'snip-line' + (n === snippet.line ? ' hot' : '')}>
                      <span className="snip-n">{n}</span>
                      <span className="snip-code">{ln || ' '}</span>
                    </div>
                  )
                })}
              </pre>
            </>
          )}

          {/* #3 — stack clicable + colapsar frames de framework */}
          {leaf.status === 'failed' && leaf.stack && <StackTrace stack={leaf.stack} />}

          {leaf.status === 'passed' && !wasFailing && <div className="ok">Test passed.</div>}
          {leaf.status === 'skipped' && <div className="warn">Test skipped.</div>}

          {leaf.stdout && (
            <>
              <div className="detail-label">Output</div>
              <pre className="stdout">{leaf.stdout}</pre>
            </>
          )}
        </>
      )}

      {active === 'changes' && <GitChanges leaf={leaf} />}
    </div>
  )
}

function StackTrace({ stack }: { stack: string }) {
  const [showAll, setShowAll] = useState(false)
  const lines = useMemo(
    () =>
      stack
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0)
        .map((text) => {
          const m = text.match(LOC)
          return { text, file: m?.[1], line: m ? parseInt(m[2], 10) : 0, located: !!m }
        }),
    [stack],
  )
  const hiddenCount = lines.filter((l) => !l.located).length

  return (
    <>
      <div className="detail-label warn">
        Stack trace
        {hiddenCount > 0 && (
          <button className="stack-toggle" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'hide framework frames' : `show ${hiddenCount} framework frame(s)`}
          </button>
        )}
      </div>
      <pre className="stack">
        {lines.map((l, i) => {
          if (!l.located && !showAll) return null
          if (l.located) {
            return (
              <div key={i} className="stack-line located">
                <button className="link-loc" onClick={() => window.engine.openInEditor({ file: l.file!, line: l.line })} title="Open in editor">
                  {l.text}
                </button>
              </div>
            )
          }
          return (
            <div key={i} className="stack-line ext">
              {l.text}
            </div>
          )
        })}
      </pre>
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, keyFor, type Status, type TestLeaf, type GitFrame } from './store'

const STATUS_ICON: Record<Status, string> = {
  passed: '✓',
  failed: '✗',
  skipped: '⊘',
  running: '●',
  notrun: '·',
}

function BrandMark({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 L27.7 9 L27.7 23 L16 29.5 L4.3 23 L4.3 9 Z" fill="none" stroke={`url(#${id})`} strokeWidth="2.4" />
      <path
        d="M9.5 16.5 L14 21 L23 9.8"
        fill="none"
        stroke="#48e08a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function useCounts() {
  const tree = useStore((s) => s.tree)
  return useMemo(() => {
    let total = 0,
      passed = 0,
      failed = 0,
      skipped = 0
    for (const proj of Object.values(tree))
      for (const cls of Object.values(proj))
        for (const leaf of Object.values(cls)) {
          total++
          if (leaf.status === 'passed') passed++
          else if (leaf.status === 'failed') failed++
          else if (leaf.status === 'skipped') skipped++
        }
    return { total, passed, failed, skipped }
  }, [tree])
}

function IsolatedControl() {
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

function TopBar() {
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
        onChange={(e) => s.setConfig({ selectedBranch: e.target.value })}
        title="Branch"
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

function allNodeKeys(tree: Record<string, Record<string, Record<string, unknown>>>): string[] {
  const keys: string[] = []
  for (const [proj, classes] of Object.entries(tree)) {
    keys.push(proj)
    for (const cls of Object.keys(classes)) keys.push(proj + '::' + cls)
  }
  return keys
}

// Etiqueta + chips de un decorador (Category, Feature…); como fragmento para que cada chip
// sea un item flex del contenedor y haga wrap a varias líneas.
function FacetChips({ name, disabled }: { name: string; disabled?: boolean }) {
  const facets = useStore((s) => s.facets)
  const selectedFacets = useStore((s) => s.selectedFacets)
  const toggleFacet = useStore((s) => s.toggleFacet)
  const values = facets[name] ?? []
  if (values.length === 0) return null
  return (
    <>
      <span className="facet-name">{name}</span>
      {values.map((value) => {
        const on = (selectedFacets[name] ?? []).includes(value)
        return (
          <button
            key={value}
            className={'pchip' + (on ? ' on' : '')}
            disabled={disabled}
            onClick={() => toggleFacet(name, value)}
          >
            {value}
          </button>
        )
      })}
    </>
  )
}

function Header() {
  const phase = useStore((s) => s.phase)
  return (
    <div className={'header header-' + phase}>
      <div className="header-id">
        <span className="brand">
          <BrandMark id="bm-head" className="brand-mark" />
          <span className="b-dotnet">dotnet</span>
          <span className="b-test">test</span>
          <span className="b-studio">studio</span>
          <span className="brand-version">v{__APP_VERSION__}</span>
        </span>
      </div>
    </div>
  )
}

function classStatus(leaves: TestLeaf[]): Status {
  if (leaves.some((l) => l.status === 'failed')) return 'failed'
  if (leaves.some((l) => l.status === 'running')) return 'running'
  if (leaves.every((l) => l.status === 'passed')) return 'passed'
  if (leaves.some((l) => l.status === 'notrun')) return 'notrun'
  return 'skipped'
}

type Filters = {
  search: string
  selectedFacets: Record<string, string[]>
  statusFilter: Status[]
  testTraits: Record<string, { name: string; value: string }[]>
}

function leafMatches(leaf: TestLeaf, f: Filters): boolean {
  if (f.search) {
    const q = f.search.toLowerCase()
    if (!leaf.name.toLowerCase().includes(q) && !leaf.fqn.toLowerCase().includes(q)) return false
  }
  if (f.statusFilter.length > 0 && !f.statusFilter.includes(leaf.status)) return false
  const facetNames = Object.keys(f.selectedFacets).filter((n) => f.selectedFacets[n].length > 0)
  if (facetNames.length > 0) {
    const traits = f.testTraits[leaf.fqn] ?? []
    for (const name of facetNames) {
      const wanted = f.selectedFacets[name]
      if (!traits.some((t) => t.name === name && wanted.includes(t.value))) return false
    }
  }
  return true
}

function useFilters(): Filters {
  return {
    search: useStore((s) => s.searchQuery),
    selectedFacets: useStore((s) => s.selectedFacets),
    statusFilter: useStore((s) => s.statusFilter),
    testTraits: useStore((s) => s.testTraits),
  }
}

function useVisibleCount(): number {
  const tree = useStore((s) => s.tree)
  const filters = useFilters()
  return useMemo(() => {
    let v = 0
    for (const classes of Object.values(tree))
      for (const tests of Object.values(classes))
        for (const leaf of Object.values(tests)) if (leafMatches(leaf, filters)) v++
    return v
  }, [tree, filters])
}

const STATUS_CHIPS: { status: Status; label: string }[] = [
  { status: 'passed', label: '✓' },
  { status: 'failed', label: '✗' },
  { status: 'skipped', label: '⊘' },
  { status: 'notrun', label: '·' },
]

function FiltersArea() {
  const projects = useStore((s) => s.testProjects)
  const selected = useStore((s) => s.selectedProjects)
  const toggleProject = useStore((s) => s.toggleProject)
  const setAll = useStore((s) => s.setAllProjects)
  const explored = useStore((s) => s.explored)
  const facets = useStore((s) => s.facets)
  const search = useStore((s) => s.searchQuery)
  const statusFilter = useStore((s) => s.statusFilter)
  const setSearch = useStore((s) => s.setSearch)
  const toggleStatus = useStore((s) => s.toggleStatus)
  const visible = useVisibleCount()

  const phase = useStore((s) => s.phase)
  const tree = useStore((s) => s.tree)
  const setAllCollapsed = useStore((s) => s.setAllCollapsed)
  const running = phase === 'preparing' || phase === 'building' || phase === 'discovering' || phase === 'running'

  const showProjects = projects.length >= 2
  if (!showProjects && !explored) return null

  const allOn = selected.length === projects.length
  const facetNames = Object.keys(facets)
  const categoryNames = facetNames.filter((n) => n.toLowerCase() === 'category')
  const otherNames = facetNames.filter((n) => n.toLowerCase() !== 'category')

  return (
    <>
      {/* Top: projects + search + category + status */}
      <div className="filter-row">
        {showProjects && (
          <>
            <span className="facet-name">projects</span>
            <button className="pchip toggle" disabled={running} onClick={() => setAll(!allOn)}>
              {allOn ? 'none' : 'all'}
            </button>
            {projects.map((p) => {
              const on = selected.includes(p.name)
              return (
                <button
                  key={p.name}
                  className={'pchip' + (on ? ' on' : '')}
                  disabled={running}
                  onClick={() => toggleProject(p.name)}
                  title={p.path}
                >
                  <span className="pcheck">{on ? '✓' : '○'}</span>
                  {p.name}
                </button>
              )
            })}
          </>
        )}
        {explored && (
          <>
            {showProjects && <span className="fb-sep" />}
            <input
              className="search"
              placeholder="search tests…"
              value={search}
              disabled={running}
              onChange={(e) => setSearch(e.target.value)}
            />
            {categoryNames.map((name) => (
              <FacetChips key={name} name={name} disabled={running} />
            ))}
            <span className="fb-sep" />
            <span className="facet-name">status</span>
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.status}
                className={'pchip status-' + c.status + (statusFilter.includes(c.status) ? ' on' : '')}
                disabled={running}
                onClick={() => toggleStatus(c.status)}
              >
                {c.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Below: features (and any other decorator) + tree controls + count */}
      {explored && (
        <div className="filter-row">
          {otherNames.map((name) => (
            <FacetChips key={name} name={name} disabled={running} />
          ))}
          <span className="fb-count">
            <button className="pchip" onClick={() => setAllCollapsed(false, allNodeKeys(tree))} title="Expand all">
              ▾ expand
            </button>
            <button className="pchip" onClick={() => setAllCollapsed(true, allNodeKeys(tree))} title="Collapse all">
              ▸ collapse
            </button>
            <span className="muted">{visible} visible</span>
          </span>
        </div>
      )}
    </>
  )
}

function TestTree() {
  const tree = useStore((s) => s.tree)
  const selectedKey = useStore((s) => s.selectedKey)
  const select = useStore((s) => s.select)
  const collapsed = useStore((s) => s.collapsed)
  const toggleNode = useStore((s) => s.toggleNode)
  const filters = useFilters()

  const projects = Object.entries(tree)
  if (projects.length === 0) return <div className="tree empty">Select a folder and click Explore.</div>

  return (
    <div className="tree">
      {projects.map(([proj, classes]) => {
        const classEntries = Object.entries(classes)
          .map(([cls, tests]) => [cls, Object.values(tests).filter((l) => leafMatches(l, filters))] as const)
          .filter(([, leaves]) => leaves.length > 0)
        if (classEntries.length === 0) return null
        const projCollapsed = !!collapsed[proj]
        return (
        <div key={proj}>
          <div className="row row-project" onClick={() => toggleNode(proj)}>
            <span className="expander">{projCollapsed ? '▸' : '▾'}</span>
            <span className={'glyph ' + classStatus(classEntries.flatMap(([, l]) => l))}>▣</span>
            <span className="label">{proj}</span>
            <span className="cnt-mini">{classEntries.reduce((n, [, l]) => n + l.length, 0)}</span>
          </div>
          {!projCollapsed && classEntries.map(([cls, leaves]) => {
            const clsKey = proj + '::' + cls
            const clsCollapsed = !!collapsed[clsKey]
            return (
              <div key={cls}>
                <div className="row row-class" onClick={() => toggleNode(clsKey)}>
                  <span className="expander">{clsCollapsed ? '▸' : '▾'}</span>
                  <span className={'glyph ' + classStatus(leaves)}>{STATUS_ICON[classStatus(leaves)]}</span>
                  <span className="label">{cls}</span>
                  <span className="cnt-mini">{leaves.length}</span>
                </div>
                {!clsCollapsed && leaves.map((leaf) => {
                  const key = keyFor(proj, cls, leaf.name)
                  return (
                    <div
                      key={key}
                      className={'row row-test ' + leaf.status + (selectedKey === key ? ' selected' : '')}
                      onClick={() => select(key)}
                    >
                      <span className={'glyph ' + leaf.status}>{STATUS_ICON[leaf.status]}</span>
                      <span className="label">{leaf.name}</span>
                      {(leaf.status === 'passed' || leaf.status === 'failed') && (
                        <span className="dur">{Math.round(leaf.durationMs)} ms</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        )
      })}
    </div>
  )
}

function findLeaf(key: string | null): TestLeaf | null {
  const { tree } = useStore.getState()
  if (!key) return null
  for (const [proj, classes] of Object.entries(tree))
    for (const [cls, tests] of Object.entries(classes))
      for (const leaf of Object.values(tests)) if (keyFor(proj, cls, leaf.name) === key) return leaf
  return null
}

function Detail() {
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

function GitChanges({ leaf }: { leaf: TestLeaf }) {
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

function LoadingOverlay() {
  const phase = useStore((s) => s.phase)
  const msg = useStore((s) => s.phaseMessage)
  const loadingProjects = useStore((s) => s.loadingProjects)
  const wtBusy = useStore((s) => s.wtBusy)
  const cancel = useStore((s) => s.cancel)
  const logs = useStore((s) => s.logs)

  // El modal solo cuando no hay árbol que explorar: cargando/preparando/compilando/descubriendo.
  // Durante 'running' NO se muestra: el árbol se colorea en vivo y es navegable.
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

function ErrorOverlay() {
  const phase = useStore((s) => s.phase)
  const msg = useStore((s) => s.phaseMessage)
  const logs = useStore((s) => s.logs)
  const dismiss = useStore((s) => s.dismissError)
  if (phase !== 'failed') return null

  // Extrae las líneas de error de la salida de compilación (CS####, ": error", etc.).
  const errorLines = logs.filter((l) => /(?::\s*error|\berror\s+[A-Z]{1,3}\d{2,5}\b|\berror\b)/i.test(l))
  const shown = (errorLines.length > 0 ? errorLines : logs).slice(-12)

  return (
    <div className="overlay">
      <div className="modal modal-error">
        <div className="modal-error-head">
          <i className="ti ti-alert-triangle" />
          <span>{msg || 'Something went wrong'}</span>
        </div>
        {shown.length > 0 && (
          <pre className="modal-error-body mono">{shown.join('\n')}</pre>
        )}
        <div className="muted small">Tests were not run because of the error above.</div>
        <button className="btn" onClick={() => dismiss()}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

function StatusBar() {
  const s = useStore()
  const c = useCounts()
  const visible = useVisibleCount()
  const elapsed = s.startedAt ? ((s.finishedAt ?? Date.now()) - s.startedAt) / 1000 : 0
  // El progreso es relativo a lo que abarca el run (lo lanzado), no al total del árbol.
  const denom = s.runTotal > 0 ? s.runTotal : c.total
  const pct = (n: number) => (denom ? (n / denom) * 100 : 0)
  const done = c.passed + c.failed + c.skipped
  const labelFor = (p: string): string => {
    switch (p) {
      case 'idle':
        return 'ready'
      case 'failed':
        return 'error'
      case 'completed':
        if (done === 0 && c.total > 0) return 'explored'
        return c.failed > 0 ? 'failed' : 'passed'
      default:
        return p
    }
  }
  return (
    <div className="statusbar">
      <span className={'phase phase-' + s.phase}>{labelFor(s.phase)}</span>
      {s.phaseMessage && <span className="muted st-msg">{s.phaseMessage}</span>}
      <span className="st-spacer" />
      <div className="bar">
        <span className="bar-pass" style={{ width: pct(c.passed) + '%' }} />
        <span className="bar-fail" style={{ width: pct(c.failed) + '%' }} />
        <span className="bar-skip" style={{ width: pct(c.skipped) + '%' }} />
      </div>
      <span className="cnt pass">✓ {c.passed}</span>
      <span className="cnt fail">✗ {c.failed}</span>
      <span className="cnt skip">⊘ {c.skipped}</span>
      <span className="muted">
        {c.total} tests
        {visible !== c.total ? ` · ${visible} shown` : ''} · ⏱ {elapsed.toFixed(1)}s
      </span>
    </div>
  )
}

function MainArea() {
  const [treeWidth, setTreeWidth] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const main = ref.current
    if (!main) return
    const rect = main.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      const w = ev.clientX - rect.left
      setTreeWidth(Math.max(220, Math.min(rect.width - 260, w)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const cols = treeWidth ? `${treeWidth}px 6px minmax(0, 1fr)` : 'minmax(0, 1.4fr) 6px minmax(0, 1fr)'

  return (
    <div className="main" ref={ref} style={{ gridTemplateColumns: cols }}>
      <LoadingOverlay />
      <ErrorOverlay />
      <div className="pane-tree">
        <TestTree />
      </div>
      <div className="resizer" onMouseDown={startDrag} title="Drag to resize" />
      <div className="pane-detail">
        <Detail />
      </div>
    </div>
  )
}

export function App() {
  const applyEvents = useStore((s) => s.applyEvents)
  const loadPresets = useStore((s) => s.loadPresets)

  useEffect(() => {
    // Agrupa la avalancha de eventos de descubrimiento en un render por frame.
    const buffer: { method: string; payload: any }[] = []
    let scheduled = false
    const flush = () => {
      scheduled = false
      if (buffer.length === 0) return
      const batch = buffer.splice(0, buffer.length)
      applyEvents(batch)
    }
    const off = window.engine.onEvent((method, payload) => {
      buffer.push({ method, payload })
      if (!scheduled) {
        scheduled = true
        requestAnimationFrame(flush)
      }
    })
    void loadPresets().catch(() => {})
    return off
  }, [applyEvents, loadPresets])

  const useWorktree = useStore((s) => s.useWorktree)
  const wtStatus = useStore((s) => s.wtStatus)
  const wtBranch = useStore((s) => s.wtBranch)
  const selectedBranch = useStore((s) => s.selectedBranch)
  const wtReady = wtStatus === 'ready' && wtBranch === selectedBranch

  return (
    <div className="app">
      <BrandMark id="bm-bg" className="app-watermark" />
      <Header />
      <TopBar />
      {useWorktree && (
        <div className="info-bar">
          <i className="ti ti-info-circle" />
          {wtReady ? (
            <>
              Running in isolated worktree <b>{wtBranch}</b> — your checkout stays untouched. Reused across
              Explore/Run; use the ▾ menu to recreate or destroy.
            </>
          ) : (
            <>
              Isolated mode on. Create the worktree for <b>{selectedBranch}</b> (Isolated ▾ ▸ Create) to run
              tests in isolation without touching your checkout.
            </>
          )}
        </div>
      )}
      <FiltersArea />
      <MainArea />
      <StatusBar />
    </div>
  )
}

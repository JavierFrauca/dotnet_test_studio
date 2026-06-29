import { useStore, keyFor } from '../store'
import { useFilters } from '../lib/hooks'
import { leafMatches } from '../lib/filters'
import { classStatus, STATUS_ICON } from '../lib/ui'

export function TestTree() {
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

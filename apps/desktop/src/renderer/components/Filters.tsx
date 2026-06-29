import { useStore } from '../store'
import { useVisibleCount } from '../lib/hooks'
import { allNodeKeys, STATUS_CHIPS } from '../lib/ui'

/** Etiqueta + chips de un decorador (Category, Feature…); fragmento para que cada chip sea un
 *  item flex del contenedor y haga wrap a varias líneas. */
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

export function FiltersArea() {
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

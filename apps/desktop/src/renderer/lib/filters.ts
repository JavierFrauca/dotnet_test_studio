import type { Status, TestLeaf } from '../store'

/** Criterios de filtrado de la vista. `statusFilter` vacío = no filtra por estado. */
export type Filters = {
  search: string
  selectedFacets: Record<string, string[]>
  statusFilter: Status[]
  testTraits: Record<string, { name: string; value: string }[]>
}

/**
 * Único predicado de coincidencia, compartido por la vista (árbol/contadores) y por el run
 * del store. El filtro por estado solo se aplica si `statusFilter` trae elementos, así que el
 * run puede reutilizarlo pasando `statusFilter: []` (lanza por búsqueda + decoradores, no por
 * estado, que es solo de visualización).
 */
export function leafMatches(leaf: TestLeaf, f: Filters): boolean {
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

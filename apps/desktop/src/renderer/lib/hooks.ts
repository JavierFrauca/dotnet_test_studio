import { useMemo } from 'react'
import { useStore } from '../store'
import { leafMatches, type Filters } from './filters'

/** Totales del árbol completo (todas las hojas), independientes de los filtros de vista. */
export function useCounts() {
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

/** Filtros de vista actuales, leídos del store. */
export function useFilters(): Filters {
  return {
    search: useStore((s) => s.searchQuery),
    selectedFacets: useStore((s) => s.selectedFacets),
    statusFilter: useStore((s) => s.statusFilter),
    testTraits: useStore((s) => s.testTraits),
  }
}

/** Nº de hojas que pasan los filtros de vista (lo que se ve / se lanzaría). */
export function useVisibleCount(): number {
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

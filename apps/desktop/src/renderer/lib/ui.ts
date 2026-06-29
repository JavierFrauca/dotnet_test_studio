import { useStore, keyFor, type Status, type TestLeaf } from '../store'

export const STATUS_ICON: Record<Status, string> = {
  passed: '✓',
  failed: '✗',
  skipped: '⊘',
  running: '●',
  notrun: '·',
}

export const STATUS_CHIPS: { status: Status; label: string }[] = [
  { status: 'passed', label: '✓' },
  { status: 'failed', label: '✗' },
  { status: 'skipped', label: '⊘' },
  { status: 'notrun', label: '·' },
]

/** Estado agregado de un nodo (clase/proyecto) a partir de sus hojas. */
export function classStatus(leaves: TestLeaf[]): Status {
  if (leaves.some((l) => l.status === 'failed')) return 'failed'
  if (leaves.some((l) => l.status === 'running')) return 'running'
  if (leaves.every((l) => l.status === 'passed')) return 'passed'
  if (leaves.some((l) => l.status === 'notrun')) return 'notrun'
  return 'skipped'
}

/** Claves de todos los nodos colapsables (proyecto y proyecto::clase) para expandir/colapsar todo. */
export function allNodeKeys(tree: Record<string, Record<string, Record<string, unknown>>>): string[] {
  const keys: string[] = []
  for (const [proj, classes] of Object.entries(tree)) {
    keys.push(proj)
    for (const cls of Object.keys(classes)) keys.push(proj + '::' + cls)
  }
  return keys
}

/** Localiza una hoja por su clave en el árbol actual del store. */
export function findLeaf(key: string | null): TestLeaf | null {
  const { tree } = useStore.getState()
  if (!key) return null
  for (const [proj, classes] of Object.entries(tree))
    for (const [cls, tests] of Object.entries(classes))
      for (const leaf of Object.values(tests)) if (keyFor(proj, cls, leaf.name) === key) return leaf
  return null
}

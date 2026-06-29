import { useRef, useState } from 'react'
import { LoadingOverlay, ErrorOverlay } from './Overlays'
import { TestTree } from './TestTree'
import { Detail } from './Detail'

/** Área principal: árbol | splitter arrastrable | detalle, con los overlays modales encima. */
export function MainArea() {
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

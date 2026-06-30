import { useEffect } from 'react'
import { useStore } from './store'
import { BrandMark } from './components/BrandMark'
import { Header } from './components/Header'
import { TopBar } from './components/TopBar'
import { FiltersArea } from './components/Filters'
import { MainArea } from './components/MainArea'
import { StatusBar } from './components/StatusBar'
import { Notice } from './components/Notice'
import { BranchCheckoutModal } from './components/BranchCheckoutModal'
import { RunFeedback } from './components/RunFeedback'

export function App() {
  const applyEvents = useStore((s) => s.applyEvents)
  const loadPresets = useStore((s) => s.loadPresets)
  const refreshRepoState = useStore((s) => s.refreshRepoState)
  const restoreSession = useStore((s) => s.restoreSession)

  useEffect(() => {
    // Re-sincroniza la rama real al recuperar el foco (el checkout pudo cambiar por consola/IDE).
    const onFocus = () => void refreshRepoState()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshRepoState])

  // Restaura la última sesión (carpeta + proyectos + rama/modo) al arrancar.
  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  // Persiste el subconjunto relevante de la sesión cuando cambia.
  useEffect(() => {
    let prevJson = ''
    return useStore.subscribe((s) => {
      if (!s.solution) return
      const j = JSON.stringify({
        path: s.solution.path,
        useWorktree: s.useWorktree,
        selectedBranch: s.selectedBranch,
        selectedProjects: s.selectedProjects,
      })
      if (j !== prevJson) {
        prevJson = j
        try {
          localStorage.setItem('dts.session', j)
        } catch {
          /* almacenamiento no disponible */
        }
      }
    })
  }, [])

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
      <Notice />
      <FiltersArea />
      <MainArea />
      <StatusBar />
      <BranchCheckoutModal />
      <RunFeedback />
    </div>
  )
}

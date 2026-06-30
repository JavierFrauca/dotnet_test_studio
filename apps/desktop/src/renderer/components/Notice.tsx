import { useEffect } from 'react'
import { useStore } from '../store'

/** Banner breve (p.ej. "nada que ejecutar"). Se autodescarta a los pocos segundos. */
export function Notice() {
  const notice = useStore((s) => s.notice)
  const setNotice = useStore((s) => s.setNotice)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 7000)
    return () => clearTimeout(t)
  }, [notice, setNotice])

  if (!notice) return null
  return (
    <div className="notice">
      <i className="ti ti-alert-triangle" />
      <span className="notice-text">{notice}</span>
      <button className="iconbtn" title="Dismiss" onClick={() => setNotice(null)}>
        <i className="ti ti-x" />
      </button>
    </div>
  )
}

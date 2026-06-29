import { useStore } from '../store'
import { BrandMark } from './BrandMark'

export function Header() {
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

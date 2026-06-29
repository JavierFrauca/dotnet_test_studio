/** Marca de la app: hexágono (degradado púrpura→azul) + check verde. */
export function BrandMark({ id, className }: { id: string; className?: string }) {
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

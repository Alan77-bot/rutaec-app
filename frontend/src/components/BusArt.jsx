import { useId } from 'react'

export default function BusArt({ tipo = 'normal', color = '#1f7a8c', className = '' }) {
  const uid = useId().replace(/:/g, '')
  const g = `g${uid}`
  const v = `v${uid}`

  const defs = (
    <defs>
      <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".28" />
        <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".22" />
      </linearGradient>
      <linearGradient id={v} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e4f3f6" />
        <stop offset="1" stopColor="#9fc3cb" />
      </linearGradient>
    </defs>
  )

  const sombra = <ellipse cx="160" cy="132" rx="140" ry="7" fill="#1b3f68" opacity=".18" />
  const ruedas = (xs, y) =>
    xs.map((x) => (
      <g key={x}>
        <circle cx={x} cy={y} r="14" fill="#18242a" />
        <circle cx={x} cy={y} r="7" fill="#d5dcdc" />
        <circle cx={x} cy={y} r="2.5" fill="#6d7a7d" />
      </g>
    ))
  const faros = <rect x="300" y="96" width="9" height="8" rx="3" fill="#ffe9a8" />

  if (tipo === 'dospisos') {
    return (
      <svg viewBox="0 0 320 150" className={className} role="img" aria-label="Bus de dos pisos">
        {defs}
        {sombra}
        <rect x="12" y="12" width="298" height="112" rx="18" fill={color} />
        <rect x="12" y="12" width="298" height="112" rx="18" fill={`url(#${g})`} />
        <rect x="12" y="66" width="298" height="6" fill="rgba(0,0,0,.2)" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={'a' + i} x={28 + i * 36} y="24" width="28" height="30" rx="6" fill={`url(#${v})`} />)}
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={'b' + i} x={28 + i * 36} y="80" width="28" height="26" rx="6" fill={`url(#${v})`} />)}
        <path d="M254 80h34a10 10 0 0 1 10 10v16h-44z" fill={`url(#${v})`} />
        <rect x="12" y="116" width="298" height="8" rx="4" fill="rgba(0,0,0,.28)" />
        {faros}
        {ruedas([78, 250], 126)}
      </svg>
    )
  }
  if (tipo === 'chiva') {
    return (
      <svg viewBox="0 0 320 150" className={className} role="img" aria-label="Chiva">
        {defs}
        {sombra}
        <rect x="40" y="22" width="190" height="9" rx="3" fill="#6b4a2b" />
        <rect x="56" y="8" width="64" height="16" rx="3" fill="#8a6338" />
        <rect x="128" y="12" width="40" height="12" rx="3" fill="#a77a43" />
        <rect x="12" y="40" width="298" height="82" rx="12" fill={color} />
        <rect x="12" y="40" width="298" height="82" rx="12" fill={`url(#${g})`} />
        <rect x="12" y="40" width="298" height="12" rx="6" fill="#f2c14e" />
        <rect x="12" y="104" width="298" height="10" fill="#f2c14e" />
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={26 + i * 42} y="58" width="32" height="38" rx="4" fill="#26323a" opacity=".82" />)}
        <path d="M234 58h56a8 8 0 0 1 8 8v30h-64z" fill={`url(#${v})`} />
        {faros}
        {ruedas([72, 250], 126)}
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 320 150" className={className} role="img" aria-label="Bus normal">
      {defs}
      {sombra}
      <rect x="12" y="30" width="298" height="94" rx="20" fill={color} />
      <rect x="12" y="30" width="298" height="94" rx="20" fill={`url(#${g})`} />
      <rect x="12" y="92" width="298" height="8" fill="rgba(0,0,0,.18)" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={28 + i * 34} y="44" width="26" height="34" rx="6" fill={`url(#${v})`} />)}
      <path d="M262 44h30a12 12 0 0 1 12 12v22h-42z" fill={`url(#${v})`} />
      <rect x="12" y="116" width="298" height="8" rx="4" fill="rgba(0,0,0,.28)" />
      {faros}
      {ruedas([76, 244], 126)}
    </svg>
  )
}

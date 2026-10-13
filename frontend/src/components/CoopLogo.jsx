export default function CoopLogo({ coop, size = 44, className = '' }) {
  if (!coop) return null
  return (
    <span className={'coop-logo ' + className} style={{ width: size, height: size, '--c': coop.color }} title={coop.nombre}>
      {coop.logo ? <img src={coop.logo} alt={`Logo de ${coop.nombre}`} /> : <b>{coop.nombre[0]}</b>}
    </span>
  )
}

export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const parse = (s) => new Date(s + 'T00:00:00')

export const addDays = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)

export const hoy = () => iso(new Date())

export const fechaLarga = (s) =>
  parse(s).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })

export const fechaCorta = (s) =>
  parse(s).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })

export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

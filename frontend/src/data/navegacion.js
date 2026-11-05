import { apartadosAdmin, apartadosGerente } from './apartados.js'

const enlace = (titulo, to, icono) => ({ titulo, to, icono })
export function navegacionPorRol(rol) {
  const cuenta = { titulo: 'Mi cuenta', opciones: [enlace('Mi perfil', '/perfil', 'user')] }
  const panel = (titulo, ruta, apartados) => ({ titulo, opciones: apartados.map(o => ({ ...o, to: `${ruta}?seccion=${o.id}` })) })
  switch (rol) {
    case 'admin': return [panel('Administración', '/admin', apartadosAdmin), cuenta]
    case 'cooperativa': return [panel('Mi cooperativa', '/cooperativa', apartadosGerente), { titulo: 'Operaciones', opciones: [enlace('Revisiones', '/revisiones', 'shield'), enlace('Cancelar viajes', '/cancelacion-viajes', 'calendar'), enlace('Reportes', '/reporte-operativo', 'receipt')] }, cuenta]
    case 'oficinista': return [{ titulo: 'Atención y ventas', opciones: [enlace('Ventanilla', '/oficinista', 'wallet'), enlace('Revisiones', '/revisiones', 'shield'), enlace('Reservas', '/mis-reservas', 'ticket'), enlace('Reportes', '/reporte-operativo', 'receipt'), enlace('Incidencias', '/incidencias', 'mail')] }, cuenta]
    case 'usuario': return [{ titulo: 'Mis viajes', opciones: [enlace('Buscar viajes', '/', 'search'), enlace('Mis reservas', '/mis-reservas', 'ticket'), enlace('Mis boletos', '/mis-viajes', 'qr'), enlace('Mis solicitudes', '/incidencias', 'mail')] }, cuenta]
    default: return []
  }
}

export function enlaceActivo(to, pathname, search) {
  const [ruta, consulta] = to.split('?')
  if (consulta) {
    const defecto = ruta === '/admin' ? 'coops' : 'hoja'
    const apartados = ruta === '/admin' ? apartadosAdmin : apartadosGerente
    const solicitada = new URLSearchParams(search).get('seccion')
    const actual = apartados.some(o => o.id === solicitada) ? solicitada : defecto
    return pathname === ruta && actual === new URLSearchParams(consulta).get('seccion')
  }
  if (ruta === '/') return ['/', '/buscar', '/comprar'].some(p => p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/'))
  if (ruta === '/mis-reservas') return pathname === ruta || pathname.startsWith('/reserva/') || pathname.startsWith('/pagar/')
  if (ruta === '/mis-viajes') return pathname === ruta || pathname.startsWith('/boleto/')
  return pathname === ruta
}

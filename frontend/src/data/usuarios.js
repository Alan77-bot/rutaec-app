// Cuentas de prueba. En el backend las contraseñas van con hash (bcrypt) y la sesión con JWT.
export const USUARIOS_INICIALES = [
  { id: 1, nombre: 'Administrador ViajaYa', correo: 'admin@viajaya.ec', clave: 'Admin2026!', rol: 'admin', coopId: null },
  { id: 2, nombre: 'Pedro Sánchez', correo: 'gerencia@amazonas.ec', clave: 'Coop2026!', rol: 'cooperativa', coopId: 'amazonas' },
  { id: 3, nombre: 'Carla Mena', correo: 'carla@amazonas.ec', clave: 'Ofi2026!', rol: 'oficinista', coopId: 'amazonas' },
  { id: 4, nombre: 'Estudiante Demo', correo: 'usuario@demo.ec', clave: 'Usuario2026!', rol: 'usuario', coopId: null },
]

export const ROLES = {
  usuario: 'Usuario final',
  oficinista: 'Oficinista',
  cooperativa: 'Cooperativa',
  admin: 'Administrador',
}

export const RUTA_POR_ROL = {
  usuario: '/',
  oficinista: '/oficinista',
  cooperativa: '/cooperativa',
  admin: '/admin',
}

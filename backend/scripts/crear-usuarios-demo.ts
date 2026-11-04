import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Solo se permite crear estas cuentas en development.');
  const cooperativaA = process.env.DEMO_COOPERATIVA_A;
  const cooperativaB = process.env.DEMO_COOPERATIVA_B;
  if (!cooperativaA || !cooperativaB || cooperativaA === cooperativaB) throw new Error('Configura dos cooperativas diferentes en DEMO_COOPERATIVA_A y DEMO_COOPERATIVA_B.');
  const cooperativas = await prisma.cooperativas.findMany({ where: { id: { in: [cooperativaA, cooperativaB] }, activa: true }, select: { id: true, nombre_comercial: true } });
  if (cooperativas.length !== 2) throw new Error('Ambas cooperativas deben existir y estar activas.');
  const cuentas = [
    { correo: 'admin.prueba@example.com', nombres: 'Administrador', apellidos: 'Prueba', rol: 'ADMINISTRADOR', coopId: null },
    { correo: 'gerente.a@example.com', nombres: 'Gerente', apellidos: 'Prueba A', rol: 'GERENTE', coopId: cooperativaA },
    { correo: 'oficinista.a@example.com', nombres: 'Oficinista', apellidos: 'Prueba A', rol: 'OFICINISTA', coopId: cooperativaA },
    { correo: 'gerente.b@example.com', nombres: 'Gerente', apellidos: 'Prueba B', rol: 'GERENTE', coopId: cooperativaB },
    { correo: 'oficinista.b@example.com', nombres: 'Oficinista', apellidos: 'Prueba B', rol: 'OFICINISTA', coopId: cooperativaB },
    { correo: 'cliente.prueba@example.com', nombres: 'Cliente', apellidos: 'Prueba', rol: 'CLIENTE', coopId: null },
  ];
  const clave = process.env.DEMO_PASSWORD || `RutaEC-${randomBytes(8).toString('hex')}!`;
  if (clave.length < 12 || Buffer.byteLength(clave, 'utf8') > 72) throw new Error('La contraseña debe tener al menos 12 caracteres y hasta 72 bytes.');
  const password_hash = await bcrypt.hash(clave, 12);
  await prisma.$transaction(async tx => {
    const existentes = await tx.usuarios.count({ where: { OR: cuentas.map(c => ({ correo: { equals: c.correo, mode: 'insensitive' as const } })) } });
    if (existentes) throw new Error('Ya existe alguno de los correos de prueba. No se cambiaron cuentas, contraseñas ni permisos.');
    for (const codigo of ['ADMINISTRADOR', 'GERENTE', 'OFICINISTA', 'CLIENTE']) {
      await tx.roles.upsert({ where: { codigo }, update: {}, create: { codigo, nombre: codigo } });
    }
    for (const [indice, cuenta] of cuentas.entries()) {
      await tx.usuarios.create({ data: {
        correo: cuenta.correo, nombres: cuenta.nombres, apellidos: cuenta.apellidos,
        tipo_documento: 'OTRO', pais_documento: 'EC', numero_documento: `DEMO-${randomUUID()}`,
        telefono: `09900000${String(indice + 10).padStart(2, '0')}`,
        password_hash, activo: true, correo_verificado_en: new Date(),
        ...(cuenta.coopId
          ? { miembros_cooperativa: { create: { cooperativa_id: cuenta.coopId, rol: cuenta.rol, activo: true } } }
          : { roles_globales: { create: { rol: cuenta.rol } } }),
      } });
    }
  });
  console.log(JSON.stringify({ creadas: cuentas.map(c => ({ correo: c.correo, rol: c.rol, cooperativa: cooperativas.find(co => co.id === c.coopId)?.nombre_comercial || null })), clave }, null, 2));

  // Comprueba el inicio de sesión real sin enviar correos ni conservar sesiones de prueba.
  const base = process.env.DEMO_API_URL || 'http://localhost:3000/api';
  const origin = new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
  for (const cuenta of cuentas) {
    const respuesta = await fetch(`${base}/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ correo: cuenta.correo, clave }) });
    const datos = await respuesta.json() as { error?: string; sesion?: { rol: string; coopId: string | null } };
    if (!respuesta.ok || !datos.sesion) throw new Error(`No se pudo verificar ${cuenta.correo}: ${datos.error || respuesta.status}`);
    const esperado = cuenta.rol === 'ADMINISTRADOR' ? 'admin' : cuenta.rol === 'GERENTE' ? 'cooperativa' : cuenta.rol === 'OFICINISTA' ? 'oficinista' : 'usuario';
    if (datos.sesion.rol !== esperado || datos.sesion.coopId !== cuenta.coopId) throw new Error(`La sesión de ${cuenta.correo} no coincide con su rol o cooperativa.`);
    const cookie = respuesta.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    try {
      if (cuenta.coopId) {
        const prohibido = cuenta.rol === 'GERENTE' ? (cuenta.coopId === cooperativaA ? cooperativaB : cooperativaA) : cuenta.coopId;
        const acceso = await fetch(`${base}/cooperativas/${prohibido}/personalizacion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ color_primario: '#123456' }) });
        if (acceso.status !== 403) throw new Error(`Permisos inesperados para ${cuenta.correo}: ${acceso.status}`);
      }
      console.log(`VERIFICADO ${cuenta.correo}: ${esperado}${cuenta.coopId ? ', aislamiento correcto' : ''}`);
    } finally {
      await fetch(`${base}/usuarios/logout`, { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
    }
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'No se pudieron crear las cuentas.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());

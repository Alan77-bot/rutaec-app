import 'dotenv/config';
import { Pool } from 'pg';

// Mantenimiento local: solo registros identificados por preparar-demo.ts.
if (process.env.NODE_ENV !== 'development') throw new Error('Solo permitido en desarrollo.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = await pool.connect();
try {
  await db.query('BEGIN');
  await db.query(`SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s'`);
  await db.query(`
    CREATE TEMP TABLE demo_frecuencias ON COMMIT DROP AS SELECT id FROM rutaec.frecuencias WHERE codigo IN ('DEMO-A-0800','DEMO-B-1000');
    CREATE TEMP TABLE demo_buses ON COMMIT DROP AS SELECT b.id FROM rutaec.buses b JOIN rutaec.grupos_buses g ON g.id=b.grupo_id WHERE g.nombre='Grupo DEMO funcional' AND b.placa IN ('DEA-9001','DEA-9002','DEB-9001');
    CREATE TEMP TABLE demo_viajes ON COMMIT DROP AS SELECT id FROM rutaec.viajes WHERE frecuencia_id IN (SELECT id FROM demo_frecuencias);
    CREATE TEMP TABLE demo_compras ON COMMIT DROP AS SELECT id FROM rutaec.compras WHERE viaje_id IN (SELECT id FROM demo_viajes);
    CREATE TEMP TABLE demo_pagos ON COMMIT DROP AS SELECT id FROM rutaec.pagos WHERE compra_id IN (SELECT id FROM demo_compras);
    CREATE TEMP TABLE demo_validaciones ON COMMIT DROP AS SELECT v.id FROM rutaec.validaciones_descuento v JOIN rutaec.politicas_descuento p ON p.id=v.politica_id WHERE p.codigo IN ('DEMO-MENOR','DEMO-TERCERA','DEMO-DISCAPACIDAD') AND p.fuente_normativa='DEMO ACADÉMICA. No representa una norma legal.';
    CREATE TEMP TABLE demo_revisiones ON COMMIT DROP AS SELECT id FROM rutaec.revisiones WHERE pago_id IN (SELECT id FROM demo_pagos) OR validacion_id IN (SELECT id FROM demo_validaciones);
    CREATE TEMP TABLE demo_incidencias ON COMMIT DROP AS SELECT id FROM rutaec.incidencias WHERE compra_id IN (SELECT id FROM demo_compras);
    CREATE TEMP TABLE demo_eventos ON COMMIT DROP AS SELECT id FROM rutaec.eventos_salida WHERE entidad_id IN (SELECT id FROM demo_compras UNION SELECT id FROM demo_validaciones UNION SELECT id FROM demo_pagos UNION SELECT id FROM demo_viajes);
    CREATE TEMP TABLE demo_usuarios ON COMMIT DROP AS SELECT id FROM rutaec.usuarios WHERE correo IN ('gerente.a@example.com','gerente.b@example.com','oficinista.a@example.com','oficinista.b@example.com','cliente.prueba@example.com') OR correo ~ '^registro\\.demo\\.[0-9]+@example\\.com$';
  `);
  const inventario = await db.query(`SELECT
    (SELECT count(*)::int FROM demo_buses) buses,
    (SELECT count(*)::int FROM demo_frecuencias) frecuencias,
    (SELECT count(*)::int FROM demo_viajes) viajes,
    (SELECT count(*)::int FROM demo_compras) compras,
    (SELECT count(*)::int FROM demo_pagos) pagos,
    (SELECT count(*)::int FROM demo_validaciones) validaciones,
    (SELECT count(*)::int FROM rutaec.usuarios WHERE activo AND id IN (SELECT id FROM demo_usuarios)) cuentas_a_desactivar`);
  console.log(JSON.stringify({ modo: process.env.APLICAR_LIMPIEZA === 'SI' ? 'APLICAR' : 'INSPECCION', ...inventario.rows[0] }));
  const pagos = await db.query(`SELECT proveedor,estado,count(*)::int cantidad FROM rutaec.pagos WHERE id IN (SELECT id FROM demo_pagos) GROUP BY proveedor,estado`);
  console.log(JSON.stringify({ pagos: pagos.rows }));
  console.log(JSON.stringify({ frecuenciasConResolucionDemo: (await db.query(`SELECT f.codigo,r.nombre AS ruta,(SELECT count(*)::int FROM rutaec.viajes WHERE frecuencia_id=f.id) viajes FROM rutaec.frecuencias f JOIN rutaec.rutas r ON r.id=f.ruta_id JOIN rutaec.resoluciones re ON re.id=f.resolucion_id WHERE re.numero IN ('DEMO-2026-A','DEMO-2026-B')`)).rows }));
  if (process.env.APLICAR_LIMPIEZA !== 'SI') { await db.query('ROLLBACK'); }
  else {
    const externos = await db.query(`SELECT
      EXISTS(SELECT 1 FROM rutaec.viajes v JOIN rutaec.agenda_bus a ON a.id=v.agenda_id WHERE a.bus_id IN (SELECT id FROM demo_buses) AND v.id NOT IN (SELECT id FROM demo_viajes)) AS otros_viajes,
      EXISTS(SELECT 1 FROM rutaec.pagos WHERE id IN (SELECT id FROM demo_pagos) AND estado IN ('APROBADO','RECIBIDO_INCIDENCIA') AND proveedor IS DISTINCT FROM 'DEMO_SIN_COBRO') AS cobros_no_demo,
      EXISTS(SELECT 1 FROM rutaec.detalle_compra WHERE validacion_descuento_id IN (SELECT id FROM demo_validaciones) AND compra_id NOT IN (SELECT id FROM demo_compras)) AS descuentos_ajenos`);
    if (Object.values(externos.rows[0]).some(Boolean)) throw new Error('Hay operaciones ajenas a la demostración. No se cambió ningún dato.');
    await db.query(`
      DELETE FROM rutaec.envios_correo WHERE compra_id IN (SELECT id FROM demo_compras) OR evento_id IN (SELECT id FROM demo_eventos);
      DELETE FROM rutaec.notificaciones WHERE evento_id IN (SELECT id FROM demo_eventos);
      DELETE FROM rutaec.eventos_salida WHERE id IN (SELECT id FROM demo_eventos);
      DELETE FROM rutaec.historial_revisiones WHERE revision_id IN (SELECT id FROM demo_revisiones);
      DELETE FROM rutaec.revisiones WHERE id IN (SELECT id FROM demo_revisiones);
      DELETE FROM rutaec.reembolsos WHERE incidencia_id IN (SELECT id FROM demo_incidencias) OR pago_id IN (SELECT id FROM demo_pagos);
      DELETE FROM rutaec.incidencias WHERE id IN (SELECT id FROM demo_incidencias);
      DELETE FROM rutaec.comprobantes_pago WHERE pago_id IN (SELECT id FROM demo_pagos);
      DELETE FROM rutaec.eventos_proveedor WHERE pago_id IN (SELECT id FROM demo_pagos);
      DELETE FROM rutaec.pagos WHERE id IN (SELECT id FROM demo_pagos);
      DELETE FROM rutaec.boletos WHERE compra_id IN (SELECT id FROM demo_compras);
      DELETE FROM rutaec.detalle_compra WHERE compra_id IN (SELECT id FROM demo_compras);
      DELETE FROM rutaec.compras WHERE id IN (SELECT id FROM demo_compras);
      DELETE FROM rutaec.validaciones_descuento WHERE id IN (SELECT id FROM demo_validaciones);
      DELETE FROM rutaec.politicas_descuento WHERE codigo IN ('DEMO-MENOR','DEMO-TERCERA','DEMO-DISCAPACIDAD') AND fuente_normativa='DEMO ACADÉMICA. No representa una norma legal.';
      -- Solo durante esta transacción de mantenimiento; las FK permanecen activas.
      ALTER TABLE rutaec.asientos_viaje DISABLE TRIGGER proteger_asientos;
      ALTER TABLE rutaec.tarifas_viaje DISABLE TRIGGER proteger_tarifas;
      ALTER TABLE rutaec.paradas_viaje DISABLE TRIGGER proteger_paradas;
      ALTER TABLE rutaec.agenda_bus DISABLE TRIGGER agenda_protegida;
      DELETE FROM rutaec.asientos_viaje WHERE viaje_id IN (SELECT id FROM demo_viajes);
      DELETE FROM rutaec.tarifas_viaje WHERE viaje_id IN (SELECT id FROM demo_viajes);
      DELETE FROM rutaec.paradas_viaje WHERE viaje_id IN (SELECT id FROM demo_viajes);
      DELETE FROM rutaec.viajes WHERE id IN (SELECT id FROM demo_viajes);
      DELETE FROM rutaec.agenda_bus WHERE bus_id IN (SELECT id FROM demo_buses);
      ALTER TABLE rutaec.asientos_viaje ENABLE TRIGGER proteger_asientos;
      ALTER TABLE rutaec.tarifas_viaje ENABLE TRIGGER proteger_tarifas;
      ALTER TABLE rutaec.paradas_viaje ENABLE TRIGGER proteger_paradas;
      ALTER TABLE rutaec.agenda_bus ENABLE TRIGGER agenda_protegida;
      DELETE FROM rutaec.dias_frecuencia WHERE frecuencia_id IN (SELECT id FROM demo_frecuencias);
      DELETE FROM rutaec.frecuencias WHERE id IN (SELECT id FROM demo_frecuencias);
      DELETE FROM rutaec.paradas_ruta WHERE ruta_id IN (SELECT id FROM rutaec.rutas WHERE nombre IN ('DEMO A: Ambato - Latacunga - Quito','DEMO B: Ambato - Latacunga - Quito'));
      DELETE FROM rutaec.rutas WHERE nombre IN ('DEMO A: Ambato - Latacunga - Quito','DEMO B: Ambato - Latacunga - Quito');
      DELETE FROM rutaec.asientos_bus WHERE bus_id IN (SELECT id FROM demo_buses);
      DELETE FROM rutaec.bus_comodidades WHERE bus_id IN (SELECT id FROM demo_buses);
      DELETE FROM rutaec.buses WHERE id IN (SELECT id FROM demo_buses);
      DELETE FROM rutaec.hojas_ruta WHERE grupo_id IN (SELECT id FROM rutaec.grupos_buses WHERE nombre='Grupo DEMO funcional');
      DELETE FROM rutaec.grupos_buses WHERE nombre='Grupo DEMO funcional';
      DELETE FROM rutaec.resoluciones r WHERE numero IN ('DEMO-2026-A','DEMO-2026-B') AND autoridad='DEMO ACADÉMICA - SIN VALIDEZ OFICIAL' AND NOT EXISTS(SELECT 1 FROM rutaec.frecuencias f WHERE f.resolucion_id=r.id);
      DELETE FROM rutaec.cuentas_bancarias c WHERE banco='BANCO DEMO - NO TRANSFERIR' AND titular='DEMOSTRACIÓN SIN DINERO REAL' AND NOT EXISTS(SELECT 1 FROM rutaec.pagos p WHERE p.cuenta_bancaria_id=c.id);
      DELETE FROM rutaec.terminales t WHERE nombre LIKE 'Terminal de prueba - %' AND direccion='Punto referencial de desarrollo. Confirmar terminal y dirección antes de operar.' AND NOT EXISTS(SELECT 1 FROM rutaec.paradas_ruta p WHERE p.terminal_id=t.id) AND NOT EXISTS(SELECT 1 FROM rutaec.paradas_viaje p WHERE p.terminal_id=t.id);
      UPDATE rutaec.usuarios SET activo=false WHERE id IN (SELECT id FROM demo_usuarios);
      UPDATE rutaec.miembros_cooperativa SET activo=false WHERE usuario_id IN (SELECT id FROM demo_usuarios);
      UPDATE rutaec.tokens_acceso SET revocado_en=clock_timestamp() WHERE usuario_id IN (SELECT id FROM demo_usuarios) AND revocado_en IS NULL;
    `);
    await db.query('COMMIT');
    console.log('Limpieza confirmada. Se conserva auditoría, archivos, catálogo, cooperativas ajenas y el administrador de acceso.');
  }
} catch (error) { await db.query('ROLLBACK'); throw error; }
finally { db.release(); await pool.end(); }

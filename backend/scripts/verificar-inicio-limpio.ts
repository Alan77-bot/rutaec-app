import 'dotenv/config';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

if (process.env.NODE_ENV !== 'development') throw new Error('Solo desarrollo.');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const base='http://localhost:3000/api',origin=new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin;
let cookie='';
try {
  const pendientes=await pool.query(`SELECT
    (SELECT count(*)::int FROM rutaec.frecuencias WHERE codigo IN ('DEMO-A-0800','DEMO-B-1000')) frecuencias_demo,
    (SELECT count(*)::int FROM rutaec.buses WHERE placa IN ('DEA-9001','DEA-9002','DEB-9001')) buses_demo,
    (SELECT count(*)::int FROM rutaec.usuarios WHERE correo IN ('gerente.a@example.com','gerente.b@example.com','oficinista.a@example.com','oficinista.b@example.com','cliente.prueba@example.com') AND activo) cuentas_prueba_activas,
    (SELECT count(*)::int FROM pg_trigger WHERE tgname IN ('proteger_asientos','proteger_paradas','proteger_tarifas','agenda_protegida') AND tgenabled='O') protecciones_activas`);
  assert.deepEqual(pendientes.rows[0],{frecuencias_demo:0,buses_demo:0,cuentas_prueba_activas:0,protecciones_activas:4});
  const login=await fetch(base+'/usuarios/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({correo:'admin.prueba@example.com',clave:process.env.DEMO_PASSWORD})});
  assert.equal(login.status,200,'Se debe conservar el acceso del administrador.');
  cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const fechas='desde=2026-11-04&hasta=2026-11-30';
  for (const ruta of ['/gestion/terminales','/gestion/grupos','/gestion/politicas','/rutas/ciudades','/reportes-operativos?'+fechas,'/horarios/cancelaciones/viajes?'+fechas]) {
    const r=await fetch(base+ruta,{headers:{Cookie:cookie}}); assert.equal(r.status,200,ruta); await r.json(); console.log(`ADMIN 200 ${ruta}`);
  }
  for (const ruta of ['/gestion/terminales','/gestion/grupos','/reportes-operativos?'+fechas,'/horarios/cancelaciones/viajes?'+fechas]) {
    const r=await fetch(base+ruta);assert.equal(r.status,401,ruta);
  }
  for (const [recurso,cuerpo] of [['terminales',{ciudad_id:'invalida',nombre:'No debe crearse',direccion:'No debe crearse'}],['grupos',{cooperativa_id:'invalida',nombre:'No debe crearse',tipo:'LOCAL'}]] as const) {
    const r=await fetch(base+'/gestion/'+recurso,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(cuerpo)});assert.equal(r.status,400);console.log(`VALIDACIÓN 400 ${recurso}`);
  }
  console.log('OK: limpieza, acceso administrador, reportes, cancelaciones, catálogos y protecciones verificados. No se crearon datos.');
} finally {
  if(cookie) await fetch(base+'/usuarios/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin}});
  await pool.end();
}

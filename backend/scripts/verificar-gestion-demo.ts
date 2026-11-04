import 'dotenv/config';
import assert from 'node:assert/strict';
const base='http://localhost:3000/api',Origin=new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin;
const cookies:Record<string,string>={};
const post=(b:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
async function pedir(ruta:string,usuario='gerente',opciones:RequestInit={}){const r=await fetch(base+ruta,{...opciones,headers:{Origin,Cookie:cookies[usuario]||'',...opciones.headers}});const b=await r.json();assert.ok(r.ok,`${ruta}: ${r.status} ${JSON.stringify(b)}`);return b;}
function fecha(n:number){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date(Date.now()+n*86400000));}
async function main(){
  if(process.env.NODE_ENV!=='development'||!process.env.DEMO_PASSWORD)throw new Error('Solo desarrollo con DEMO_PASSWORD.');
  for(const [rol,correo]of [['cliente','cliente.prueba@example.com'],['gerente','gerente.a@example.com'],['otro','gerente.b@example.com'],['admin','admin.prueba@example.com']]){const r=await fetch(base+'/usuarios/login',{...post({correo,clave:process.env.DEMO_PASSWORD}),headers:{Origin,'Content-Type':'application/json'}});assert.equal(r.status,200);cookies[rol]=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
  for(const recurso of ['resoluciones','cuentas']){
    const lista=(await pedir('/gestion/'+recurso)).datos;assert.ok(lista.length);
    const fila=lista.find((r:any)=>recurso==='cuentas'?r.banco.startsWith('BANCO DEMO'):r.numero.startsWith('DEMO-'));assert.ok(fila);
    for(const k of ['fecha_emision','vigente_desde','vigente_hasta'])if(fila[k])fila[k]=fila[k].slice(0,10);
    const ajeno=await fetch(base+'/gestion/'+recurso+'/'+fila.id,{...post(fila),method:'PUT',headers:{Origin,Cookie:cookies.otro,'Content-Type':'application/json'}});assert.equal(ajeno.status,404);
    await pedir('/gestion/'+recurso+'/'+fila.id,'gerente',{...post(fila),method:'PUT'});
  }
  const politicas=(await pedir('/gestion/politicas','admin')).datos;assert.ok(politicas.length>=3);
  const config=await pedir('/ajustes','cliente');await pedir('/ajustes','admin',{...post(config),method:'PUT'});assert.deepEqual(await pedir('/ajustes','cliente'),config);
  const denegado=await fetch(base+'/ajustes',{...post(config),method:'PUT',headers:{Origin,Cookie:cookies.gerente,'Content-Type':'application/json'}});assert.equal(denegado.status,403);
  console.log('OK resoluciones y cuentas editables solo en su cooperativa, políticas y configuración general persistente');
  const hoja=(await pedir('/horarios/planificacion?'+new URLSearchParams({desde:fecha(0),hasta:fecha(7)}))).datos;assert.ok(hoja.viajes.length>=7);
  const f=(await pedir('/horarios/frecuencias')).datos.find((f:any)=>f.codigo==='DEMO-A-0800');assert.ok(f);
  const buses=hoja.buses.filter((b:any)=>b.numero_unidad.startsWith('900'));assert.equal(buses.length,2);
  const rota=(await pedir('/horarios/planificacion/rotar','gerente',post({frecuencia_id:f.id,bus_ids:buses.map((b:any)=>b.id),desde:fecha(8),hasta:fecha(9),minutos_cierre:60,fuente_normativa:'DEMO planificación de prueba',tarifas:[{origen_orden:1,destino_orden:2,normal:3.25,vip:4.5},{origen_orden:1,destino_orden:3,normal:7.25,vip:10},{origen_orden:2,destino_orden:3,normal:4,vip:5.5}]}))).datos;
  assert.equal(rota.creados.length,2);assert.equal(rota.omitidos.length,0);
  const nuevaHoja=(await pedir('/horarios/planificacion?'+new URLSearchParams({desde:fecha(8),hasta:fecha(9)}))).datos;
  assert.equal(new Set(nuevaHoja.viajes.map((v:any)=>v.bus.placa)).size,2);
  const agenda=await pedir('/horarios/operacion/agenda','gerente',post({busId:buses[0].id,tipo:'DESCANSO',inicio:fecha(10)+'T00:00:00-05:00',fin:fecha(11)+'T00:00:00-05:00',motivo:'DEMO descanso planificado para prueba funcional.'}));
  console.log('OK hoja real, rotación entre dos buses y registro de descanso');
  const numero='17'+String(Date.now()).slice(-8),correo='registro.demo.'+Date.now()+'@example.com';
  const registro=await pedir('/usuarios/registro','cliente',post({nombres:'Registro DEMO',apellidos:'Prueba funcional',correo,numero_documento:numero,telefono:'0990000099',clave:process.env.DEMO_PASSWORD}));
  const mensajes=(await pedir('/correo-local','cliente',post({correo,clave:process.env.DEMO_PASSWORD}))).datos;
  const codigo=/código de verificación es: (\d{6})/.exec(mensajes[0].texto)?.[1];assert.ok(codigo);
  await pedir('/usuarios/verificar-correo','cliente',post({verificacionId:registro.verificacionId,codigo,clave:process.env.DEMO_PASSWORD}));
  const login=await fetch(base+'/usuarios/login',{...post({correo,clave:process.env.DEMO_PASSWORD}),headers:{Origin,'Content-Type':'application/json'}});assert.equal(login.status,200);
  const Cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');await fetch(base+'/usuarios/logout',{method:'POST',headers:{Origin,Cookie}});
  console.log('OK registro de cliente, entrega de código en correo local, verificación e inicio de sesión');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const Cookie of Object.values(cookies))await fetch(base+'/usuarios/logout',{method:'POST',headers:{Origin,Cookie}}).catch(()=>{});});

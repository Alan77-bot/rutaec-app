import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base='http://localhost:3000/api', Origin=new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin;
const cookies:Record<string,string>={};
const post=(b:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
async function pedir(ruta:string,usuario='cliente',opciones:RequestInit={}){const r=await fetch(base+ruta,{...opciones,headers:{Origin,Cookie:cookies[usuario]||'',...opciones.headers}});const b=await r.json();assert.ok(r.ok,`${ruta}: ${r.status} ${JSON.stringify(b)}`);return b;}
async function main(){
  if(process.env.NODE_ENV!=='development'||!process.env.DEMO_PASSWORD)throw new Error('Solo desarrollo con DEMO_PASSWORD.');
  for(const [rol,correo]of [['cliente','cliente.prueba@example.com'],['oficinista','oficinista.a@example.com'],['gerente','gerente.a@example.com']]){const r=await fetch(base+'/usuarios/login',{...post({correo,clave:process.env.DEMO_PASSWORD}),headers:{Origin,'Content-Type':'application/json'}});assert.equal(r.status,200);cookies[rol]=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
  const coop=(await pedir('/usuarios/yo','gerente')).sesion.coopId;
  const politica=(await pedir('/reservas/descuentos/politicas')).datos.find((p:any)=>p.codigo==='DEMO-TERCERA');assert.ok(politica);
  const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date(Date.now()+3*86400000));
  const documento='DEMO'+Date.now();const form=new FormData();
  for(const[k,v]of Object.entries({nombres:'Persona DEMO',apellidos:'Tercera edad',documento,tipoDocumento:'PASAPORTE',paisDocumento:'EC',fechaNacimiento:'1950-01-01',cooperativaId:coop,politicaId:politica.id,validoHasta:fecha}))form.set(k,v);
  form.set('archivo',new Blob(['%PDF-1.4\nDOCUMENTO SINTETICO DEMO SIN VALIDEZ\n%%EOF'],{type:'application/pdf'}),'identidad-demo.pdf');
  const solicitud=await pedir('/reservas/descuentos/solicitar','cliente',{method:'POST',body:form});
  const revision=(await pedir('/pagos/revisiones','oficinista')).datos.find((r:any)=>r.validacion_id===solicitud.id);assert.ok(revision);
  await pedir(`/pagos/revisiones/${revision.id}/tomar`,'oficinista',post({}));
  await pedir(`/pagos/revisiones/${revision.id}/resolver`,'oficinista',post({decision:'APROBAR',motivo:'Prueba académica: documento sintético, fecha de nacimiento y política DEMO revisados.'}));
  const validacion=(await pedir('/reservas/descuentos/mios')).datos.find((v:any)=>v.id===solicitud.id);assert.equal(validacion.estado,'APROBADA');
  const viaje=(await pedir('/reservas/viajes?'+new URLSearchParams({origen:'Latacunga',destino:'Quito',fecha,cooperativa:coop}))).data[0];assert.ok(viaje);
  const disponibilidad=(await pedir('/reservas/disponibilidad?'+new URLSearchParams({viajeId:viaje.viaje_id,origen:'Latacunga',destino:'Quito'}))).data;
  const asiento=disponibilidad.asientos.find((a:any)=>a.estado==='LIBRE'&&a.categoria==='NORMAL');assert.ok(asiento);
  const compra=(await pedir('/reservas/compras','cliente',post({viajeId:viaje.viaje_id,origen:'Latacunga',destino:'Quito',claveIdempotencia:randomUUID(),pasajeros:[{asientoId:asiento.id,nombres:'Persona DEMO',apellidos:'Tercera edad',documento,tipoDocumento:'PASAPORTE',paisDocumento:'EC',fechaNacimiento:'1950-01-01',validacionId:validacion.id}]}))).datos;
  assert.equal(Number(compra.total),2);assert.equal(Number(compra.detalle_compra[0].descuento),2);
  console.log('OK solicitud documental, revisión de descuento, compra entre paradas y descuento de 50% aplicado en servidor');
  await pedir('/reservas/compras/'+compra.id+'/cancelar','cliente',post({motivo:'Fin de prueba DEMO de descuento; liberar asiento.'}));
  const comprador=(await pedir('/ventas/comprador?correo=cliente.prueba%40example.com','oficinista')).datos;
  const venta=(await pedir('/reservas/compras','oficinista',post({compradorId:comprador.id,viajeId:viaje.viaje_id,origen:'Latacunga',destino:'Quito',claveIdempotencia:randomUUID(),pasajeros:[{asientoId:asiento.id,nombres:'Venta DEMO',apellidos:'Ventanilla',documento:'VENT'+Date.now(),tipoDocumento:'PASAPORTE',paisDocumento:'EC',fechaNacimiento:'1990-01-01'}]}))).datos;
  assert.equal(venta.comprador_id,comprador.id);console.log('OK ventanilla: consulta comprador y reserva a nombre del cliente');
  await pedir('/reservas/compras/'+venta.id+'/cancelar','oficinista',post({motivo:'Fin de prueba DEMO de ventanilla; liberar asiento.'}));
  await pedir('/usuarios/recuperar-contrasena','cliente',post({correo:'cliente.prueba@example.com'}));
  const correos=(await pedir('/correo-local','cliente',post({correo:'cliente.prueba@example.com',clave:process.env.DEMO_PASSWORD}))).datos;
  assert.ok(correos.some((c:any)=>c.asunto.includes('contraseña')&&c.texto.includes('restablecer-contrasena')));
  console.log('OK recuperación con correo local protegido por credenciales');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const Cookie of Object.values(cookies))await fetch(base+'/usuarios/logout',{method:'POST',headers:{Origin,Cookie}}).catch(()=>{});});

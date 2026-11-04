import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';

const base='http://localhost:3000/api', origin=process.env.FRONTEND_URL || 'http://localhost:5173';
const clave=process.env.DEMO_PASSWORD;
const sesiones: Record<string,string>={};
async function pedir(ruta:string, quien='cliente', opciones:RequestInit={}) {
  const respuesta=await fetch(base+ruta,{...opciones,headers:{Origin:new URL(origin).origin,...(sesiones[quien]?{Cookie:sesiones[quien]}:{}),...opciones.headers}});
  const cuerpo=await respuesta.json();
  assert.ok(respuesta.ok,`${ruta}: ${respuesta.status} ${JSON.stringify(cuerpo)}`);
  return cuerpo;
}
const post=(body:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function main(){
  if(process.env.NODE_ENV!=='development'||!clave)throw new Error('Requiere development y DEMO_PASSWORD.');
  for(const [nombre,correo] of [['cliente','cliente.prueba@example.com'],['oficinista','oficinista.a@example.com'],['gerente','gerente.a@example.com'],['otro','oficinista.b@example.com'],['admin','admin.prueba@example.com']]){
    const r=await fetch(base+'/usuarios/login',{...post({correo,clave}),headers:{'Content-Type':'application/json',Origin:new URL(origin).origin}});assert.equal(r.status,200);sesiones[nombre]=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  }
  const yo=await pedir('/usuarios/yo','gerente');const coop=yo.sesion.coopId;
  const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date(Date.now()+2*86400000));
  const consulta=new URLSearchParams({origen:'Ambato',destino:'Quito',fecha,cooperativa:coop});
  const viajes=(await pedir('/reservas/viajes?'+consulta)).data;assert.ok(viajes.length);assert.ok(viajes.every((v:any)=>v.cooperativa.id===coop));
  const viaje=viajes[0];
  const disponibles=(await pedir('/reservas/disponibilidad?'+new URLSearchParams({viajeId:viaje.viaje_id,origen:'Ambato',destino:'Quito'}))).data;
  const asiento=disponibles.asientos.find((a:any)=>a.estado==='LIBRE'&&a.categoria==='NORMAL');assert.ok(asiento);
  const solicitud={viajeId:viaje.viaje_id,origen:'Ambato',destino:'Quito',claveIdempotencia:randomUUID(),pasajeros:[{asientoId:asiento.id,nombres:'Pasajero DEMO',apellidos:'Prueba funcional',documento:'DEMO'+Date.now(),tipoDocumento:'PASAPORTE',paisDocumento:'EC',fechaNacimiento:'1990-01-01'}]};
  const compra=(await pedir('/reservas/compras','cliente',post(solicitud))).datos;
  const repetida=(await pedir('/reservas/compras','cliente',post(solicitud))).datos;assert.equal(repetida.id,compra.id);
  const conflicto=await fetch(base+'/reservas/compras',{...post({...solicitud,claveIdempotencia:randomUUID()}),headers:{'Content-Type':'application/json',Origin:new URL(origin).origin,Cookie:sesiones.cliente}});assert.equal(conflicto.status,409);
  console.log('OK búsqueda, reserva, idempotencia y bloqueo de asiento');
  const info=(await pedir('/pagos/cuentas/'+compra.id)).datos;const cuenta=info.cuentas.find((c:any)=>c.banco.startsWith('BANCO DEMO'));assert.ok(cuenta);
  const pdf=new PDFDocument();const partes:Buffer[]=[];pdf.on('data',d=>partes.push(d));const terminado=new Promise<Buffer>(resolve=>pdf.on('end',()=>resolve(Buffer.concat(partes))));pdf.text('COMPROBANTE DE PRUEBA - SIN DINERO REAL');pdf.text('Referencia DEMO '+compra.id);pdf.end();
  const archivo=await terminado;
  const referencia='DEMO-'+randomUUID().slice(0,12), form=new FormData();
  for(const [k,v]of Object.entries({compra_id:compra.id,metodo:'TRANSFERENCIA',cuenta_bancaria_id:cuenta.id,clave_idempotencia:randomUUID(),numero_referencia:referencia,fecha_operacion:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date()),importe_declarado:String(compra.total)}))form.set(k,String(v));
  form.set('archivo',new Blob([new Uint8Array(archivo)],{type:'application/pdf'}),'comprobante-demo.pdf');
  await pedir('/pagos','cliente',{method:'POST',body:form});
  const revisiones=(await pedir('/pagos/revisiones','oficinista')).datos;const revision=revisiones.find((r:any)=>r.pagos?.compra_id===compra.id);assert.ok(revision);
  const fuera=await fetch(base+'/pagos/revisiones/'+revision.id+'/tomar',{...post({}),headers:{'Content-Type':'application/json',Origin:new URL(origin).origin,Cookie:sesiones.otro}});assert.equal(fuera.status,404);
  await pedir('/pagos/revisiones/'+revision.id+'/tomar','oficinista',post({}));
  await pedir('/pagos/revisiones/'+revision.id+'/resolver','oficinista',post({decision:'APROBAR',motivo:'DEMO: comprobante sintético y cuenta de prueba, no hubo movimiento de dinero.',importeVerificado:String(compra.total),referencia}));
  const final=(await pedir('/reservas/compras/'+compra.id)).datos;assert.equal(final.estado,'CONFIRMADA');assert.equal(final.boletos.length,1);
  const boleto=final.boletos[0];
  for(const ruta of [`/boletos/${boleto.id}/pdf`,`/boletos/${boleto.id}/qr`,`/boletos/recibos/${compra.id}`]){const r=await fetch(base+ruta,{headers:{Cookie:sesiones.cliente}});assert.equal(r.status,200,ruta);assert.ok((await r.arrayBuffer()).byteLength>100);}
  const historial=(await pedir('/boletos/mios')).datos;assert.ok(historial.some((b:any)=>b.id===boleto.id));
  console.log('OK comprobante, aislamiento de revisión, aprobación, boleto PDF/QR, recibo e historial');
  console.log(JSON.stringify({compra:compra.id,boleto:boleto.id,fecha,cooperativa:coop}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const cookie of Object.values(sesiones))await fetch(base+'/usuarios/logout',{method:'POST',headers:{Origin:new URL(origin).origin,Cookie:cookie}}).catch(()=>{});});

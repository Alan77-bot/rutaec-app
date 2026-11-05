import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';

// Jamás apunta a la base operativa. Crear/restaurar previamente esta copia aislada.
const url=new URL(process.env.DATABASE_URL!);url.pathname='/rutaec_redisenio_pruebas';
process.env.DATABASE_URL=url.toString();process.env.NODE_ENV='development';
process.env.SMTP_USER='';process.env.SMTP_PASS='';process.env.TARJETA_MODO_DEMO='true';
process.env.PERSONALIZACION_DIR='/tmp/rutaec-redisenio/imagenes';
process.env.DOCUMENTOS_DIR='/tmp/rutaec-redisenio/documentos';process.env.COMPROBANTES_DIR='/tmp/rutaec-redisenio/comprobantes';
const {prisma}=await import('../src/lib/prisma.js');
const clave=`QA-${randomBytes(16).toString('hex')}!`,hash=await bcrypt.hash(clave,12),marca=randomUUID().slice(0,8);
const doc=()=>{const b='180'+String(randomInt(0,1000000)).padStart(6,'0');const suma=[...b].reduce((s,d,i)=>{let n=Number(d)*(i%2===0?2:1);return s+(n>9?n-9:n)},0);return b+String((10-suma%10)%10)};
const coops=[];
for(const letra of ['A','B'])coops.push(await prisma.cooperativas.findFirst({where:{nombre_comercial:`QA Aislada rediseño ${letra}`}}) || await prisma.cooperativas.create({data:{ruc:String(randomInt(1000000000000,9999999999999)),razon_social:`QA ${marca} ${letra}`,nombre_comercial:`QA Aislada rediseño ${letra}`,correo:`coop.${letra}.${marca}@example.invalid`,telefono:'0990000001',direccion:'Datos aislados de prueba'}}));
for(const codigo of ['ADMINISTRADOR','CLIENTE','GERENTE','OFICINISTA'])await prisma.roles.upsert({where:{codigo},update:{},create:{codigo,nombre:codigo}});
for(const [correo,rol,coop] of [['admin.prueba@example.com','ADMINISTRADOR',null],['cliente.prueba@example.com','CLIENTE',null],['gerente.a@example.com','GERENTE',coops[0].id],['gerente.b@example.com','GERENTE',coops[1].id],['oficinista.a@example.com','OFICINISTA',coops[0].id],['oficinista.b@example.com','OFICINISTA',coops[1].id]] as const){
  const previo=await prisma.usuarios.findFirst({where:{correo}});
  const u=await prisma.usuarios.upsert({where:{id:previo?.id||randomUUID()},update:{activo:true,correo_verificado_en:new Date(),password_hash:hash},create:{correo,nombres:'QA',apellidos:rol,tipo_documento:'OTRO',pais_documento:'EC',numero_documento:randomUUID(),telefono:'0990000001',password_hash:hash,activo:true,correo_verificado_en:new Date()}});
  await prisma.miembros_cooperativa.updateMany({where:{usuario_id:u.id},data:{activo:false}});
  if(coop)await prisma.miembros_cooperativa.upsert({where:{cooperativa_id_usuario_id:{cooperativa_id:coop,usuario_id:u.id}},update:{activo:true,rol},create:{cooperativa_id:coop,usuario_id:u.id,rol,activo:true}});
  else await prisma.roles_globales.upsert({where:{usuario_id_rol:{usuario_id:u.id,rol}},update:{},create:{usuario_id:u.id,rol}});
}
for(const nombre of ['Ambato','Latacunga','Quito']){const ciudad=await prisma.ciudades.findFirstOrThrow({where:{nombre}});await prisma.terminales.upsert({where:{ciudad_id_nombre:{ciudad_id:ciudad.id,nombre:'Terminal de prueba - '+nombre}},update:{},create:{ciudad_id:ciudad.id,nombre:'Terminal de prueba - '+nombre,direccion:'Solo copia aislada'}})}
const preparado=spawnSync(process.execPath,['--import','tsx','scripts/preparar-demo.ts'],{env:process.env,stdio:'inherit'});assert.equal(preparado.status,0);
const {default:app}=await import('../src/app.js');
const servidor=app.listen(0);await new Promise<void>(r=>servidor.once('listening',r));
const direccion=servidor.address();assert.ok(direccion&&typeof direccion!=='string');
const base=`http://127.0.0.1:${direccion.port}/api`,Origin=new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin;
const cookies:Record<string,string>={};
const post=(datos:unknown)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});
async function pedir(ruta:string,rol='cliente',opciones:RequestInit={},esperado=200){const r=await fetch(base+ruta,{...opciones,headers:{Origin,Cookie:cookies[rol]||'',...opciones.headers}});const b=await r.json();assert.equal(r.status,esperado,`${ruta}: ${JSON.stringify(b)}`);return b;}
async function login(rol:string,correo:string){const r=await fetch(base+'/usuarios/login',{...post({correo,clave}),headers:{Origin,'Content-Type':'application/json'}});assert.equal(r.status,200,`login ${rol}`);cookies[rol]=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')}
async function pdf(){const d=new PDFDocument(),trozos:Buffer[]=[];d.on('data',x=>trozos.push(x));const fin=new Promise<Buffer>(r=>d.on('end',()=>r(Buffer.concat(trozos))));d.text('PRUEBA AISLADA SIN TRANSFERENCIA');d.end();return fin;}
try{
  for(const [rol,correo]of [['cliente','cliente.prueba@example.com'],['oficina','oficinista.a@example.com'],['otra','oficinista.b@example.com'],['gerente','gerente.a@example.com'],['gerenteB','gerente.b@example.com'],['admin','admin.prueba@example.com']])await login(rol,correo);
  const cantidad=await prisma.usuarios.count();
  const comprador={documento:doc(),nombres:'Comprador',apellidos:'Presencial',correo:''};
  await pedir('/ventas/comprador','oficina',post(comprador));assert.equal(await prisma.usuarios.count(),cantidad);
  await pedir('/ventas/comprador','oficina',post({...comprador,documento:'0000000000'}),400);
  const salidas=(await pedir('/ventas/salidas','oficina')).datos;assert.ok(salidas.length>0);
  let viaje: any;
  for(let offset=1;offset<=7;offset++){
    const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date(Date.now()+offset*86400000));
    const viajes=(await pedir('/reservas/viajes?'+new URLSearchParams({origen:'Latacunga',destino:'Quito',fecha,cooperativa:coops[0].id}))).data;
    if(!viajes.length)continue;
    const libre=(await pedir('/reservas/disponibilidad?'+new URLSearchParams({viajeId:viajes[0].viaje_id,origen:'Latacunga',destino:'Quito'}))).data;
    if(libre.asientos.filter((a:any)=>a.estado==='LIBRE'&&a.categoria==='NORMAL').length>=5){viaje=viajes[0];break;}
  }
  assert.ok(viaje,'La copia necesita una salida con cinco asientos normales libres.');
  async function reservar(rol='oficina',extras:Record<string,unknown>={}){
    const disponibles=(await pedir('/reservas/disponibilidad?'+new URLSearchParams({viajeId:viaje.viaje_id,origen:'Latacunga',destino:'Quito'}),rol)).data;
    const asiento=disponibles.asientos.find((a:{estado:string;categoria:string})=>a.estado==='LIBRE'&&a.categoria==='NORMAL');assert.ok(asiento);
    const pasajero={asientoId:asiento.id,nombres:'Pasajero',apellidos:'Prueba',documento:doc(),tipoDocumento:'CEDULA',paisDocumento:'EC',fechaNacimiento:'1950-01-01',...extras};
    return (await pedir('/reservas/compras',rol,post({viajeId:viaje.viaje_id,origen:'Latacunga',destino:'Quito',compradorPresencial:rol==='oficina'?comprador:undefined,pasajeros:[pasajero],claveIdempotencia:randomUUID()}),201)).datos;
  }
  const politica=await prisma.politicas_descuento.findUniqueOrThrow({where:{codigo_version:{codigo:'DEMO-TERCERA',version:1}}});
  const compra=await reservar('oficina',{politicaId:politica.id,documentoVerificado:true});assert.equal(compra.canal,'VENTANILLA');assert.equal(Number(compra.total),2);assert.equal(compra.comprador_presencial.documento,comprador.documento);
  const cobro={compraId:compra.id,claveIdempotencia:randomUUID(),recibido:'5.00',confirmado:true};
  await pedir('/ventas/efectivo','cliente',post(cobro),403);await pedir('/ventas/efectivo','otra',post(cobro),404);
  await pedir('/ventas/efectivo','oficina',post({...cobro,recibido:'1.00'}),400);
  const efectivo=await pedir('/ventas/efectivo','oficina',post(cobro));const repetido=await pedir('/ventas/efectivo','oficina',post(cobro));assert.equal(efectivo.datos.pagoId,repetido.datos.pagoId);
  assert.equal(await prisma.pagos.count({where:{compra_id:compra.id}}),1);
  const detalle=(await pedir('/reservas/compras/'+compra.id,'oficina')).datos;assert.equal(detalle.estado,'CONFIRMADA');assert.equal(detalle.boletos.length,1);
  for(const ruta of [`/boletos/${detalle.boletos[0].id}/pdf`,`/boletos/${detalle.boletos[0].id}/qr`,`/boletos/recibos/${compra.id}`]){const r=await fetch(base+ruta,{headers:{Cookie:cookies.oficina}});assert.equal(r.status,200,ruta);assert.ok((await r.arrayBuffer()).byteLength>100)}
  console.log('OK comprador sin cuenta, salidas, descuento presencial, efectivo, idempotencia, aislamiento, boleto QR/PDF y recibo');
  const tarjeta=await reservar('cliente');await pedir('/pagos/tarjeta-demo','cliente',post({compraId:tarjeta.id,claveIdempotencia:randomUUID(),numero:'4111111111111111',titular:'Tarjeta de prueba',vencimiento:'12/35',codigoSeguridad:'123',resultado:'APROBADO'}));assert.equal((await pedir('/reservas/compras/'+tarjeta.id)).datos.estado,'CONFIRMADA');
  console.log('OK tarjeta simulada, confirmación y boletos del cliente');
  async function transferencia(rol:string){
    const c=await reservar(rol),info=(await pedir('/pagos/cuentas/'+c.id,rol)).datos;
    const form=new FormData(),ref='QA-'+randomUUID().slice(0,12);
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date());
    for(const[k,v]of Object.entries({compra_id:c.id,cuenta_bancaria_id:info.cuentas[0].id,metodo:'TRANSFERENCIA',numero_referencia:ref,fecha_operacion:hoy,importe_declarado:String(c.total),clave_idempotencia:randomUUID()}))form.append(k,v);
    form.append('archivo',new Blob([new Uint8Array(await pdf())],{type:'application/pdf'}),'comprobante.pdf');
    if(rol==='oficina')form.append('confirmado','true');
    await pedir(rol==='oficina'?'/ventas/comprobante':'/pagos',rol,{method:'POST',body:form},201);
    if(rol==='cliente'){
      const d=(await pedir('/reservas/compras/'+c.id)).datos;assert.equal(d.estado,'EN_REVISION');assert.equal(d.boletos.length,0);
      const lista=(await pedir('/pagos/revisiones','oficina')).datos;const revision=lista.find((r:{pagos?:{compra_id:string}})=>r.pagos?.compra_id===c.id);assert.ok(revision.pagos.compras.detalle_compra_detalle_compra_compra_id_comprador_idTocompras.length);
      await pedir(`/pagos/revisiones/${revision.id}/tomar`,'oficina',post({}));await pedir(`/pagos/revisiones/${revision.id}/resolver`,'oficina',post({decision:'APROBAR',motivo:'Validación de prueba aislada',importeVerificado:String(c.total),referencia:ref}));
    }
    const final=(await pedir('/reservas/compras/'+c.id,rol)).datos;assert.equal(final.estado,'CONFIRMADA');assert.equal(final.boletos.length,1);
  }
  await transferencia('oficina');await transferencia('cliente');
  console.log('OK transferencia presencial inmediata y transferencia web pendiente hasta revisión; detalle incluye remitente');
  const bus=await prisma.buses.findUniqueOrThrow({where:{placa:'DEA-9001'}});
  const imagen=new FormData();imagen.append('archivo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7k0AAAAASUVORK5CYII=','base64')],{type:'image/png'}),'bus.png');
  await pedir('/imagenes-buses/'+bus.id,'gerenteB',{method:'POST',body:imagen},404);const foto=await pedir('/imagenes-buses/'+bus.id,'gerente',{method:'POST',body:imagen},201);assert.equal((await fetch(base.replace('/api','')+foto.datos.imagen_url)).status,200);
  const gerenteCorreo=`gerente.${marca}@example.invalid`,gerenteDoc=doc();
  await pedir('/gerentes','admin',post({nombres:'Gerente',apellidos:'QA',correo:gerenteCorreo,numero_documento:gerenteDoc,telefono:'0990000001',clave,cooperativa_id:coops[0].id}),201);
  const nuevo=await prisma.usuarios.findFirstOrThrow({where:{correo:gerenteCorreo}});assert.equal(await prisma.tokens_acceso.count({where:{usuario_id:nuevo.id,proposito:'VERIFICAR_CORREO'}}),0);
  const enviar=await pedir('/usuarios/reenviar-codigo','cliente',post({correo:gerenteCorreo,clave}));const mensajes=await prisma.$queryRaw<{texto:string}[]>`SELECT texto FROM rutaec.correos_desarrollo WHERE destinatario=${gerenteCorreo} ORDER BY creado_en DESC LIMIT 1`;const codigo=mensajes[0].texto.match(/\b\d{6}\b/)?.[0];assert.ok(codigo);await pedir('/usuarios/verificar-correo','cliente',post({verificacionId:enviar.verificacionId,codigo,clave}));
  await pedir('/usuarios/reenviar-codigo','cliente',post({correo:gerenteCorreo,clave}),409);
  const oficioCorreo=`oficinista.${marca}@example.invalid`;
  await pedir('/oficinistas/crear','gerente',post({nombres:'Oficinista',apellidos:'QA',correo:oficioCorreo,numero_documento:doc(),telefono:'0990000001',clave}),201);
  const oficinaNueva=await prisma.usuarios.findFirstOrThrow({where:{correo:oficioCorreo}});assert.equal(await prisma.tokens_acceso.count({where:{usuario_id:oficinaNueva.id,proposito:'VERIFICAR_CORREO'}}),0);
  console.log('OK imagen local con aislamiento y creación de gerente/oficinista sin envío prematuro; verificación explícita funcional');
  console.log('PRUEBAS AISLADAS COMPLETADAS. No se crearon ventas ni cuentas en la base operativa.');
}finally{
  for(const Cookie of Object.values(cookies))await fetch(base+'/usuarios/logout',{method:'POST',headers:{Origin,Cookie}}).catch(()=>{});
  await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));await prisma.$disconnect();
}

import assert from 'node:assert/strict';
import {before,after,describe,it} from 'node:test';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {Server} from 'node:http';import type {AddressInfo} from 'node:net';
import bcrypt from 'bcryptjs';

// Ejecutar en base QA con datos_prueba_viajes.sql y el complemento de reservas #17.
describe('operaciones reales de perfil, pagos y revisiones',{skip:process.env.RUTAEC_TEST_DB!=='1'},()=>{
  let prisma:typeof import('../../lib/prisma.js')['prisma'],servidor:Server,base:string;
  let cliente:Cuenta,oficina:Cuenta,segundo:Cuenta,coopId:string,viajeId:string,asientos:string[],bancoId:string;
  let indice=0;const compras:string[]=[],cuentas:string[]=[];
  type Cuenta={id:string;correo:string;clave:string;cookie:string};
  async function pedir(s:Cuenta|null,ruta:string,method='GET',body?:unknown){
    const multipart=body instanceof FormData;
    const r=await fetch(base+ '/api'+ruta,{method,headers:{Origin:'http://localhost:5173',...(s?.cookie?{Cookie:s.cookie}:{}),...(!multipart?{'Content-Type':'application/json'}:{})},body:multipart?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const b=r.headers.get('content-type')?.includes('json')?await r.json():{bytes:(await r.arrayBuffer()).byteLength};
    return {status:r.status,b,cookie:r.headers.get('set-cookie')?.split(';')[0]??''};
  }
  async function entrar(c:Cuenta){const r=await pedir(null,'/usuarios/login','POST',{correo:c.correo,clave:c.clave});assert.equal(r.status,200,JSON.stringify(r.b));c.cookie=r.cookie;}
  async function cuenta(rol:'CLIENTE'|'OFICINISTA'){
    const clave=randomBytes(12).toString('hex');const correo=`qa.operaciones.${randomUUID()}@rutaec.example`;
    const u=await prisma.usuarios.create({data:{correo,nombres:'QA',apellidos:'Operaciones',tipo_documento:'OTRO',pais_documento:'EC',numero_documento:'QA-'+randomUUID(),telefono:'0990000000',password_hash:await bcrypt.hash(clave,12),activo:true,correo_verificado_en:new Date(),...(rol==='CLIENTE'?{roles_globales:{create:{rol}}}:{miembros_cooperativa:{create:{cooperativa_id:coopId,rol}}})}});
    cuentas.push(u.id);const c={id:u.id,correo,clave,cookie:''};await entrar(c);return c;
  }
  async function reservar(s=cliente,asientoId=asientos[indice++]){
    const r=await pedir(s,'/reservas/compras','POST',{viajeId,origen:'Ambato',destino:'Quito',claveIdempotencia:randomUUID(),pasajeros:[{asientoId,nombres:'QA',apellidos:'Reserva de prueba',tipoDocumento:'PASAPORTE',paisDocumento:'EC',documento:randomBytes(8).toString('hex').toUpperCase(),fechaNacimiento:'1990-01-01'}]});assert.equal(r.status,201,JSON.stringify(r.b));compras.push(r.b.datos.id);return r.b.datos;
  }
  function comprobante(compraId:string,importe:string){const f=new FormData();for(const [k,v] of Object.entries({compra_id:compraId,metodo:'TRANSFERENCIA',cuenta_bancaria_id:bancoId,clave_idempotencia:randomUUID(),numero_referencia:'QA-'+randomUUID(),fecha_operacion:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date()),importe_declarado:importe}))f.append(k,v);f.append('archivo',new Blob(['%PDF-1.4\nCOMPROBANTE SINTETICO QA SIN VALOR BANCARIO\n%%EOF'],{type:'application/pdf'}),'qa.pdf');return f;}
  async function presentar(c: {id:string;total:string}){const r=await pedir(cliente,'/pagos','POST',comprobante(c.id,String(c.total)));assert.equal(r.status,201,JSON.stringify(r.b));return prisma.revisiones.findFirstOrThrow({where:{pagos:{compra_id:c.id}}});}
  async function tomar(id:string){const r=await pedir(oficina,`/pagos/revisiones/${id}/tomar`,'POST',{});assert.equal(r.status,200,JSON.stringify(r.b));}
  before(async()=>{
    ({prisma}=await import('../../lib/prisma.js'));for(const rol of ['CLIENTE','OFICINISTA'])await prisma.roles.upsert({where:{codigo:rol},update:{},create:{codigo:rol,nombre:rol}});
    const app=(await import('../../app.js')).default;servidor=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    const v=await prisma.viajes.findFirstOrThrow({where:{cooperativas:{ruc:'9990000000001'},estado:'PUBLICADO',agenda_bus:{inicio:{gt:new Date(Date.now()+2*86400000)}}},orderBy:{cierre_ventas:'asc'}});viajeId=v.id;coopId=v.cooperativa_id;
    const filas=await prisma.$queryRaw<{id:string}[]>`SELECT a.id FROM rutaec.asientos_viaje a WHERE a.viaje_id=${viajeId}::uuid AND a.vendible AND NOT EXISTS(SELECT 1 FROM rutaec.detalle_compra d WHERE d.viaje_id=a.viaje_id AND d.asiento_id=a.id AND d.estado IN ('RETENIDO','CONFIRMADO')) ORDER BY a.id`;asientos=filas.map(a=>a.id);assert.ok(asientos.length>=8);
    cliente=await cuenta('CLIENTE');oficina=await cuenta('OFICINISTA');segundo=await cuenta('OFICINISTA');
    bancoId=(await prisma.cuentas_bancarias.create({data:{cooperativa_id:coopId,banco:'BANCO FICTICIO QA',tipo:'AHORROS',numero:randomBytes(6).toString('hex'),titular:'QA SIN DINERO REAL'}})).id;
  });
  after(async()=>{
    if(prisma){
      // Las operaciones son sintéticas: no deben sumarse como ingresos reales.
      await prisma.pagos.updateMany({where:{compra_id:{in:compras}},data:{proveedor:'DEMO_SIN_COBRO',motivo:'QA: sin cobro real'}});
      const boletos=await prisma.boletos.findMany({where:{compra_id:{in:compras}}});for(const b of boletos)await prisma.boletos.update({where:{id:b.id},data:{datos_emision:{...(b.datos_emision as Record<string,never>),modo_demo:true},estado:'ANULADO',anulado_en:new Date(),motivo_anulacion:'Fin de prueba QA'}});
      await prisma.compras.updateMany({where:{id:{in:compras}},data:{estado:'CANCELADA',motivo:'Fin de prueba QA',finalizada_en:new Date()}});
      await prisma.tokens_acceso.updateMany({where:{usuario_id:{in:cuentas},revocado_en:null},data:{revocado_en:new Date()}});await prisma.$disconnect();
    }
    if(servidor)await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));
  });
  it('cambia clave de ocho caracteres y revoca la sesión anterior',async()=>{
    const vieja=cliente.clave,r=await pedir(cliente,'/usuarios/perfil/clave','POST',{claveActual:vieja,nuevaClave:'ClaveQA8',confirmarClave:'ClaveQA8'});assert.equal(r.status,200,JSON.stringify(r.b));assert.equal((await pedir(cliente,'/usuarios/yo')).status,401);assert.equal((await pedir(null,'/usuarios/login','POST',{correo:cliente.correo,clave:vieja})).status,401);cliente.clave='ClaveQA8';await entrar(cliente);
  });
  it('restablece con token de uso único y revoca sesiones',async()=>{
    const token=randomBytes(32).toString('hex');await prisma.tokens_acceso.create({data:{usuario_id:cliente.id,proposito:'RECUPERAR_CLAVE',token_hash:createHash('sha256').update(token).digest('hex'),vence_en:new Date(Date.now()+900000)}});const body={token,nuevaClave:'NuevaQA8',confirmarClave:'NuevaQA8'};assert.equal((await pedir(null,'/usuarios/restablecer-contrasena','POST',body)).status,200);assert.equal((await pedir(cliente,'/usuarios/yo')).status,401);assert.equal((await pedir(null,'/usuarios/restablecer-contrasena','POST',body)).status,400);cliente.clave='NuevaQA8';await entrar(cliente);
  });
  it('confirma correo nuevo con código preparado y conserva el anterior hasta verificar',async()=>{
    const nuevo=`qa.correo.${randomUUID()}@rutaec.example`,codigo='123456';const t=await prisma.tokens_acceso.create({data:{usuario_id:cliente.id,proposito:'CAMBIAR_CORREO',nuevo_correo:nuevo,token_hash:await bcrypt.hash(codigo,12),vence_en:new Date(Date.now()+900000)}});assert.equal((await prisma.usuarios.findUniqueOrThrow({where:{id:cliente.id}})).correo,cliente.correo);assert.equal((await pedir(cliente,'/usuarios/perfil/correo/confirmar','POST',{verificacionId:t.id,codigo})).status,200);assert.equal((await pedir(cliente,'/usuarios/yo')).status,401);cliente.correo=nuevo;await entrar(cliente);
  });
  it('revisión exclusiva, corrección, aprobación, boleto y devolución manual',async()=>{
    const c=await reservar(),r=await presentar(c);const intentos=await Promise.all([pedir(oficina,`/pagos/revisiones/${r.id}/tomar`,'POST',{}),pedir(segundo,`/pagos/revisiones/${r.id}/tomar`,'POST',{})]);assert.deepEqual(intentos.map(i=>i.status).sort(),[200,409]);const revisor=intentos[0].status===200?oficina:segundo;
    assert.equal((await pedir(revisor,`/pagos/revisiones/${r.id}/resolver`,'POST',{decision:'CORREGIR',motivo:'Adjuntar un comprobante legible de prueba'})).status,200);
    const pago=await prisma.pagos.findFirstOrThrow({where:{compra_id:c.id}});assert.equal((await pedir(cliente,`/pagos/revisiones/pagos/${pago.id}/corregir`,'POST',comprobante(c.id,String(c.total)))).status,201);assert.equal(await prisma.comprobantes_pago.count({where:{pago_id:pago.id}}),2);await tomar(r.id);
    const aprobado=await pedir(oficina,`/pagos/revisiones/${r.id}/resolver`,'POST',{decision:'APROBAR',motivo:'Conciliación ficticia QA',importeVerificado:String(c.total),referencia:'QA-'+randomUUID()});assert.equal(aprobado.status,200,JSON.stringify(aprobado.b));assert.equal((await prisma.compras.findUniqueOrThrow({where:{id:c.id}})).estado,'CONFIRMADA');
    assert.equal((await pedir(oficina,`/pagos/revisiones/${r.id}/resolver`,'POST',{decision:'APROBAR',motivo:'Reintento QA',importeVerificado:String(c.total),referencia:'QA-repetida'})).status,409);const b=await prisma.boletos.findFirstOrThrow({where:{compra_id:c.id}});assert.equal(await prisma.boletos.count({where:{compra_id:c.id}}),1);
    for(const path of [`/boletos/${b.id}/pdf`,`/boletos/${b.id}/qr`,`/boletos/recibos/${c.id}`]){const doc=await pedir(cliente,path);assert.equal(doc.status,200);assert.ok(doc.b.bytes>0);}
    assert.equal((await pedir(cliente,'/incidencias','POST',{compraId:c.id,tipo:'DEVOLUCION',motivo:'Devolución ficticia QA'})).status,201);const inc=await prisma.incidencias.findFirstOrThrow({where:{compra_id:c.id,tipo:'DEVOLUCION'}});
    assert.equal((await pedir(oficina,`/incidencias/${inc.id}/resolver`,'POST',{decision:'REEMBOLSO',motivo:'Devolución de prueba, sin dinero real',importe:String(c.total),cancelarCompra:true})).status,200);const reembolso=await prisma.reembolsos.findFirstOrThrow({where:{incidencia_id:inc.id}});assert.equal(reembolso.estado,'APROBADO');assert.equal((await prisma.boletos.findUniqueOrThrow({where:{id:b.id}})).estado,'ANULADO');
    assert.equal((await pedir(oficina,`/incidencias/reembolsos/${reembolso.id}/realizado`,'POST',{referencia:'QA-'+randomUUID()})).status,200);assert.equal((await pedir(oficina,`/incidencias/reembolsos/${reembolso.id}/realizado`,'POST',{referencia:'QA-duplicada'})).status,409);
  });
  it('un pago tardío no ocupa el asiento que obtuvo otro cliente',async()=>{
    const id=asientos[indice++],c=await reservar(cliente,id),r=await presentar(c);const vence=new Date(Date.now()-60000);await prisma.compras.update({where:{id:c.id},data:{estado:'VENCIDA',reservada_en:new Date(vence.getTime()-300000),vence_en:vence}});const nueva=await reservar(cliente,id);await tomar(r.id);
    const confirmado=await pedir(oficina,`/pagos/revisiones/${r.id}/resolver`,'POST',{decision:'APROBAR',motivo:'Ingreso tardío ficticio QA',importeVerificado:String(c.total),referencia:'QA-'+randomUUID()});assert.equal(confirmado.status,200);assert.equal(confirmado.b.mensaje,'INCIDENCIA');assert.equal((await prisma.compras.findUniqueOrThrow({where:{id:c.id}})).estado,'INCIDENCIA');assert.equal((await prisma.compras.findUniqueOrThrow({where:{id:nueva.id}})).estado,'RESERVADA');assert.equal(await prisma.boletos.count({where:{compra_id:c.id}}),0);
  });
  it('recupera una asignación de 31 minutos sin rechazar el pago',async()=>{
    const c=await reservar(),r=await presentar(c);await tomar(r.id);await prisma.revisiones.update({where:{id:r.id},data:{tomado_en:new Date(Date.now()-31*60000)}});const {aplicarPlazosRevision}=await import('./revisiones.plazos.js');await aplicarPlazosRevision(r.id);const actual=await prisma.revisiones.findUniqueOrThrow({where:{id:r.id}});assert.equal(actual.asignado_a,null);assert.equal(actual.estado,'PENDIENTE');assert.equal((await prisma.pagos.findUniqueOrThrow({where:{id:r.pago_id!}})).estado,'EN_REVISION');
  });
  it('vence el plazo del trámite en incidencia y libera el asiento',async()=>{
    const c=await reservar(),r=await presentar(c);const {aplicarPlazosRevision,clavePolitica}=await import('./revisiones.plazos.js');await aplicarPlazosRevision(r.id);const evento=await prisma.eventos_salida.findUniqueOrThrow({where:{clave_deduplicacion:clavePolitica(r.id)}});await prisma.eventos_salida.update({where:{id:evento.id},data:{datos:{...(evento.datos as Record<string,never>),revisionVenceEn:new Date(Date.now()-1000).toISOString()}}});await aplicarPlazosRevision(r.id);assert.equal((await prisma.compras.findUniqueOrThrow({where:{id:c.id}})).estado,'INCIDENCIA');assert.equal(await prisma.detalle_compra.count({where:{compra_id:c.id,estado:'RETENIDO'}}),0);assert.equal(await prisma.incidencias.count({where:{compra_id:c.id}}),1);
  });
  it('ventanilla recibe y repite el comprobante sin duplicar el pago',async()=>{
    const c=await reservar(),f=comprobante(c.id,String(c.total));const recibido=await pedir(oficina,'/ventas/comprobante','POST',f);assert.equal(recibido.status,201,JSON.stringify(recibido.b));assert.equal((await pedir(oficina,'/ventas/comprobante','POST',f)).status,200);assert.equal(await prisma.pagos.count({where:{compra_id:c.id}}),1);
  });
  it('aprueba un descuento documental antes de reservar con tarifa reducida',async()=>{
    const codigo='QA-'+randomUUID(),documento=randomBytes(8).toString('hex').toUpperCase();const hasta=new Date(Date.now()+365*86400000).toISOString().slice(0,10);
    const politica=await prisma.politicas_descuento.create({data:{codigo,version:1,descripcion:'QA: política ficticia sin valor legal',porcentaje:'50',edad_minima:65,documento_requerido:'PASAPORTE',fuente_normativa:'Prueba QA, no oficial',vigente_desde:new Date(Date.now()-86400000)}});
    try{
      const f=new FormData();for(const [k,v] of Object.entries({nombres:'QA',apellidos:'Descuento ficticio',tipoDocumento:'PASAPORTE',paisDocumento:'EC',documento,fechaNacimiento:'1950-01-01',cooperativaId:coopId,politicaId:politica.id,validoHasta:hasta}))f.append(k,v);f.append('archivo',new Blob(['%PDF-1.4\nDOCUMENTO FICTICIO QA\n%%EOF'],{type:'application/pdf'}),'identidad-qa.pdf');
      const envio=await pedir(cliente,'/reservas/descuentos/solicitar','POST',f);assert.equal(envio.status,201,JSON.stringify(envio.b));const v=await prisma.validaciones_descuento.findUniqueOrThrow({where:{id:envio.b.id}});assert.equal((await pedir(cliente,`/reservas/descuentos/documentos/${v.documento_id}`)).status,200);const r=await prisma.revisiones.findFirstOrThrow({where:{validacion_id:v.id}});await tomar(r.id);
      assert.equal((await pedir(oficina,`/pagos/revisiones/${r.id}/resolver`,'POST',{decision:'APROBAR',motivo:'Validación ficticia QA'})).status,200);assert.equal((await prisma.validaciones_descuento.findUniqueOrThrow({where:{id:v.id}})).estado,'APROBADA');
      const reserva=await pedir(cliente,'/reservas/compras','POST',{viajeId,origen:'Ambato',destino:'Quito',claveIdempotencia:randomUUID(),pasajeros:[{asientoId:asientos[indice++],nombres:'QA',apellidos:'Descuento ficticio',tipoDocumento:'PASAPORTE',paisDocumento:'EC',documento,fechaNacimiento:'1950-01-01',validacionId:v.id}]});assert.equal(reserva.status,201,JSON.stringify(reserva.b));compras.push(reserva.b.datos.id);const d=reserva.b.datos.detalle_compra[0];assert.ok(Number(d.descuento)>0);assert.equal(Number(d.importe),Number(d.precio_base)/2);
    }finally{await prisma.politicas_descuento.update({where:{id:politica.id},data:{activa:false}});}
  });
  it('tarjeta demo aprobada/rechazada, sin duplicados ni datos completos guardados',{skip:process.env.TARJETA_MODO_DEMO!=='true'},async()=>{
    const c=await reservar(),body={compraId:c.id,claveIdempotencia:randomUUID(),numero:'4242424242424242',titular:'QA Sin Cobro',vencimiento:'12/35',codigoSeguridad:'123',resultado:'APROBADO'};
    const r=await pedir(cliente,'/pagos/tarjeta-demo','POST',body);assert.equal(r.status,200,JSON.stringify(r.b));assert.equal((await pedir(cliente,'/pagos/tarjeta-demo','POST',body)).status,200);assert.equal(await prisma.boletos.count({where:{compra_id:c.id}}),1);const pago=await prisma.pagos.findFirstOrThrow({where:{compra_id:c.id}});assert.equal(pago.proveedor,'DEMO_SIN_COBRO');assert.ok(!JSON.stringify(pago).includes(body.numero));
    const rechazada=await reservar();assert.equal((await pedir(cliente,'/pagos/tarjeta-demo','POST',{...body,compraId:rechazada.id,claveIdempotencia:randomUUID(),resultado:'RECHAZADO'})).status,200);assert.equal((await prisma.pagos.findFirstOrThrow({where:{compra_id:rechazada.id}})).estado,'FALLIDO');assert.equal(await prisma.boletos.count({where:{compra_id:rechazada.id}}),0);
  });
});

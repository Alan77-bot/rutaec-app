import assert from 'node:assert/strict';
import { before, after, describe, it } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

// Prueba optativa contra PostgreSQL real; utiliza los viajes ficticios del script
// database/scripts/datos_prueba_viajes.sql. No modifica el esquema ni datos ajenos.
describe('reservas HTTP e integridad por tramo', {skip:process.env.RUTAEC_TEST_DB!=='1'},()=>{
  let prisma:typeof import('../../lib/prisma.js')['prisma'];
  let servidor:Server,base:string,viajeId:string,coopId:string;
  let cliente:{id:string;cookie:string},otro:{id:string;cookie:string},oficina:{id:string;cookie:string};
  let asientos:string[],indice=0;
  const compras:string[]=[],usuarios:string[]=[];
  async function http(s:{cookie:string},ruta:string,method='GET',body?:unknown){
    const r=await fetch(base+'/api/reservas'+ruta,{method,headers:{Origin:'http://localhost:5173',Cookie:s.cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    return {status:r.status,b:await r.json()};
  }
  function solicitud(ids=[asientos[indice++]],origen='Ambato',destino='Quito'){
    return {viajeId,origen,destino,claveIdempotencia:randomUUID(),pasajeros:ids.map(asientoId=>({asientoId,nombres:'QA reserva',apellidos:'Prueba',tipoDocumento:'PASAPORTE',paisDocumento:'EC',documento:randomBytes(8).toString('hex').toUpperCase(),fechaNacimiento:'1990-01-01'}))};
  }
  async function crear(s=cliente,body:ReturnType<typeof solicitud>&{compradorId?:string}=solicitud()){
    const r=await http(s,'/compras','POST',body);if(r.b.datos?.id)compras.push(r.b.datos.id);return r;
  }
  async function cuenta(rol:'CLIENTE'|'OFICINISTA'){
    const clave=randomBytes(12).toString('hex');const u=await prisma.usuarios.create({data:{correo:`qa.reservas.${randomUUID()}@rutaec.example`,nombres:'QA',apellidos:'Reserva HTTP',tipo_documento:'OTRO',pais_documento:'EC',numero_documento:'QA-'+randomUUID(),telefono:'0990000000',password_hash:await bcrypt.hash(clave,12),activo:true,correo_verificado_en:new Date(),...(rol==='CLIENTE'?{roles_globales:{create:{rol}}}:{miembros_cooperativa:{create:{cooperativa_id:coopId,rol}}})}});
    usuarios.push(u.id);const r=await fetch(base+'/api/usuarios/login',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({correo:u.correo,clave})});assert.equal(r.status,200);return {id:u.id,cookie:r.headers.get('set-cookie')!.split(';')[0]};
  }
  before(async()=>{
    ({prisma}=await import('../../lib/prisma.js'));
    for(const rol of ['CLIENTE','OFICINISTA'])await prisma.roles.upsert({where:{codigo:rol},update:{},create:{codigo:rol,nombre:rol}});
    const app=(await import('../../app.js')).default;
    servidor=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    const viaje=await prisma.viajes.findFirst({where:{cooperativas:{ruc:'9990000000001'},estado:'PUBLICADO',agenda_bus:{inicio:{gt:new Date(Date.now()+86400000)}}},orderBy:{cierre_ventas:'desc'}});
    assert.ok(viaje,'Cargar primero database/scripts/datos_prueba_viajes.sql en una base local de prueba.');viajeId=viaje.id;coopId=viaje.cooperativa_id;
    const filas=await prisma.$queryRaw<{id:string}[]>`SELECT a.id FROM rutaec.asientos_viaje a WHERE a.viaje_id=${viajeId}::uuid AND a.vendible AND NOT EXISTS(SELECT 1 FROM rutaec.detalle_compra d JOIN rutaec.compras c ON c.id=d.compra_id WHERE d.viaje_id=a.viaje_id AND d.asiento_id=a.id AND (d.estado='CONFIRMADO' OR (d.estado='RETENIDO' AND (c.estado='EN_REVISION' OR (c.estado='RESERVADA' AND c.vence_en>clock_timestamp()))))) ORDER BY a.id`;
    asientos=filas.map(a=>a.id);assert.ok(asientos.length>=14,'Se necesitan 14 asientos libres en el viaje ficticio.');
    cliente=await cuenta('CLIENTE');otro=await cuenta('CLIENTE');oficina=await cuenta('OFICINISTA');
  });
  after(async()=>{
    if(prisma){
      // Preserva el historial QA y libera sus asientos; no elimina datos existentes.
      await prisma.compras.updateMany({where:{id:{in:[...new Set(compras)]}},data:{estado:'CANCELADA',motivo:'Fin de prueba automatizada QA',finalizada_en:new Date()}});
      await prisma.tokens_acceso.updateMany({where:{usuario_id:{in:usuarios},revocado_en:null},data:{revocado_en:new Date()}});
      await prisma.$disconnect();
    }
    if(servidor)await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));
  });
  it('crea y consulta una reserva de cinco minutos sin renovar el plazo',async()=>{
    const r=await crear();assert.equal(r.status,201,JSON.stringify(r.b));assert.equal(r.b.datos.estado,'RESERVADA');
    const c=r.b.datos;assert.equal(new Date(c.vence_en).getTime()-new Date(c.reservada_en).getTime(),300000);assert.equal(c.detalle_compra.length,1);
    const detalle=await http(cliente,`/compras/${c.id}`);assert.equal(detalle.status,200);assert.equal(detalle.b.datos.vence_en,c.vence_en);
  });
  it('dos reintentos simultáneos de la misma solicitud devuelven la misma compra',async()=>{
    const body=solicitud();const [a,b]=await Promise.all([crear(cliente,body),crear(cliente,body)]);assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.b.datos.id,b.b.datos.id);
  });
  it('rechaza reutilizar la clave con pasajeros diferentes',async()=>{
    const body=solicitud();assert.equal((await crear(cliente,body)).status,201);const r=await crear(cliente,{...body,pasajeros:body.pasajeros.map(p=>({...p,nombres:'Otros nombres'}))});assert.equal(r.status,409);assert.match(r.b.error,/solicitud ya se usó/i);
  });
  it('cancelar libera el asiento',async()=>{
    const r=await crear();assert.equal(r.status,201);const id=r.b.datos.id;assert.equal((await http(cliente,`/compras/${id}/cancelar`,'POST',{motivo:'Cancelación QA'})).status,200);assert.equal(await prisma.detalle_compra.count({where:{compra_id:id,estado:'RETENIDO'}}),0);
  });
  it('vence en servidor y permite reutilizar el asiento vencido',async()=>{
    const body=solicitud(),r=await crear(cliente,body);assert.equal(r.status,201);const vencimiento=new Date(Date.now()-60000);await prisma.compras.update({where:{id:r.b.datos.id},data:{reservada_en:new Date(vencimiento.getTime()-300000),vence_en:vencimiento}});
    await prisma.$queryRaw`SELECT rutaec.vencer_reservas()`;assert.equal((await http(cliente,`/compras/${r.b.datos.id}`)).b.datos.estado,'VENCIDA');assert.equal((await crear(otro,{...body,claveIdempotencia:randomUUID()})).status,201);
  });
  it('otro cliente no puede leer ni cancelar la reserva',async()=>{
    const r=await crear();assert.equal(r.status,201);assert.equal((await http(otro,`/compras/${r.b.datos.id}`)).status,404);assert.equal((await http(otro,`/compras/${r.b.datos.id}/cancelar`,'POST',{motivo:'Sin permiso'})).status,404);
  });
  it('cliente y ventanilla simultáneos: solo uno retiene el mismo asiento/tramo',async()=>{
    const body=solicitud();const [a,b]=await Promise.all([crear(cliente,body),crear(oficina,{...body,compradorId:otro.id,claveIdempotencia:randomUUID()})]);assert.deepEqual([a.status,b.status].sort(),[201,409]);const ganador=a.status===201?a:b;const perdedor=a.status===409?a:b;assert.match(perdedor.b.error,/ya no está disponible/);
    const filas=await prisma.$queryRaw<{n:number}[]>`SELECT count(*)::int AS n FROM rutaec.detalle_compra d JOIN rutaec.compras c ON c.id=d.compra_id WHERE d.viaje_id=${viajeId}::uuid AND d.asiento_id=${body.pasajeros[0].asientoId}::uuid AND d.estado='RETENIDO' AND c.estado='RESERVADA' AND c.vence_en>clock_timestamp()`;assert.equal(filas[0].n,1);assert.ok(ganador.b.datos.id);
  });
  it('dos asientos pedidos en orden inverso no generan dos reservas ni interbloqueos',async()=>{
    const ids=[asientos[indice++],asientos[indice++]];const body=solicitud(ids);const [a,b]=await Promise.all([crear(cliente,body),crear(otro,solicitud([...ids].reverse()))]);assert.deepEqual([a.status,b.status].sort(),[201,409]);
  });
  it('permite tramos consecutivos y rechaza el tramo que cruza ambos',async()=>{
    const id=asientos[indice++];assert.equal((await crear(cliente,solicitud([id],'Riobamba','Ambato'))).status,201);assert.equal((await crear(otro,solicitud([id],'Ambato','Quito'))).status,201);assert.equal((await crear(cliente,solicitud([id],'Riobamba','Quito'))).status,409);
  });
  it('conserva la ocupación de una compra en revisión o confirmada',async()=>{
    const body=solicitud(),r=await crear(cliente,body);assert.equal(r.status,201);const id=r.b.datos.id;await prisma.compras.update({where:{id},data:{estado:'EN_REVISION'}});assert.equal((await crear(otro,{...body,claveIdempotencia:randomUUID()})).status,409);await prisma.compras.update({where:{id},data:{estado:'CONFIRMADA',confirmada_en:new Date()}});assert.equal((await crear(otro,{...body,claveIdempotencia:randomUUID()})).status,409);
  });
});

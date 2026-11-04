import type { Prisma } from '../../generated/prisma/client.js';

// Mismo orden de bloqueo de asientos que crearReserva. Una confirmación tardía
// tampoco puede recuperar un tramo que ya tiene otra compra vigente.
export async function bloquearOcupacionCompra(tx:Prisma.TransactionClient,compraId:string){
  const detalles=await tx.detalle_compra.findMany({where:{compra_id:compraId},select:{asiento_id:true,viaje_id:true}});
  if(!detalles.length)return false;
  const ids=detalles.map(d=>d.asiento_id),viajeId=detalles[0].viaje_id;
  await tx.$queryRaw`SELECT id FROM rutaec.asientos_viaje WHERE viaje_id=${viajeId}::uuid AND id=ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM rutaec.compras WHERE id=${compraId}::uuid FOR UPDATE`;
  const conflictos=await tx.$queryRaw<{id:string}[]>`
    SELECT otro.id FROM rutaec.detalle_compra propio
    JOIN rutaec.detalle_compra otro ON otro.viaje_id=propio.viaje_id AND otro.asiento_id=propio.asiento_id
      AND otro.compra_id<>propio.compra_id AND otro.tramo && propio.tramo
    JOIN rutaec.compras c ON c.id=otro.compra_id
    WHERE propio.compra_id=${compraId}::uuid AND
      (otro.estado='CONFIRMADO' OR (otro.estado='RETENIDO' AND
        (c.estado='EN_REVISION' OR (c.estado='RESERVADA' AND c.vence_en>clock_timestamp())))) LIMIT 1`;
  return !conflictos.length;
}

import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { crearRuta } from '../src/modules/rutas/rutas.service.js';
import { crearFrecuencia } from '../src/modules/horarios/horarios.service.js';
import { programarViajes } from '../src/modules/horarios/horarios.viajes.js';
import { hoyEn } from '../src/modules/horarios/horarios.programacion.js';

async function main() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Los datos DEMO solo se preparan en development.');
  const hoy = hoyEn('America/Guayaquil'), inicio = new Date(hoy), fin = new Date(`${Number(hoy.slice(0,4))+1}-12-31`);
  const terminales = await prisma.terminales.findMany({ where: { nombre: { startsWith: 'Terminal de prueba - ' } }, include:{ ciudades:true } });
  const estaciones = ['Ambato','Latacunga','Quito'].map(nombre => terminales.find(t => t.ciudades.nombre === nombre));
  if (estaciones.some(t=>!t)) throw new Error('Carga primero database/init/rutaec_catalogo.sql.');
  for (const [codigo,descripcion,min,max] of [['DEMO-MENOR','Menor de edad: política académica de demostración',0,17],['DEMO-TERCERA','Tercera edad: política académica de demostración',65,null],['DEMO-DISCAPACIDAD','Discapacidad: revisión documental de demostración',null,null]] as const) {
    await prisma.politicas_descuento.upsert({ where:{codigo_version:{codigo,version:1}}, update:{}, create:{codigo,version:1,descripcion,porcentaje:50,edad_minima:min,edad_maxima:max,documento_requerido:'CEDULA',fuente_normativa:'DEMO ACADÉMICA. No representa una norma legal.',vigente_desde:inicio,vigente_hasta:fin} });
  }
  const salida = [];
  for (const [letra,correo,hora] of [['A','gerente.a@example.com','08:00'],['B','gerente.b@example.com','10:00']]) {
    const usuario = await prisma.usuarios.findFirst({ where:{correo}, include:{miembros_cooperativa:{where:{rol:'GERENTE',activo:true}}} });
    const coop = usuario?.miembros_cooperativa[0]?.cooperativa_id;
    if (!usuario || !coop) throw new Error(`Falta la cuenta de prueba ${correo}.`);
    const resolucion = await prisma.resoluciones.upsert({where:{cooperativa_id_numero:{cooperativa_id:coop,numero:`DEMO-2026-${letra}`}},update:{},create:{cooperativa_id:coop,numero:`DEMO-2026-${letra}`,autoridad:'DEMO ACADÉMICA - SIN VALIDEZ OFICIAL',fecha_emision:inicio,vigente_desde:inicio,vigente_hasta:fin}});
    await prisma.cuentas_bancarias.upsert({where:{cooperativa_id_banco_numero:{cooperativa_id:coop,banco:'BANCO DEMO - NO TRANSFERIR',numero:`000000000${letra==='A'?'1':'2'}`}},update:{},create:{cooperativa_id:coop,banco:'BANCO DEMO - NO TRANSFERIR',tipo:'AHORROS',numero:`000000000${letra==='A'?'1':'2'}`,titular:'DEMOSTRACIÓN SIN DINERO REAL'}});
    const grupo = await prisma.grupos_buses.upsert({where:{cooperativa_id_nombre:{cooperativa_id:coop,nombre:'Grupo DEMO funcional'}},update:{},create:{cooperativa_id:coop,nombre:'Grupo DEMO funcional',tipo:'LARGA_DISTANCIA'}});
    const buses=[];
    for (let n=1;n<=(letra==='A'?2:1);n++) {
      const placa=`DE${letra}-${9000+n}`;
      let bus=await prisma.buses.findUnique({where:{placa}});
      if (bus && bus.cooperativa_id!==coop) throw new Error(`La placa ${placa} ya pertenece a otra cooperativa.`);
      if (!bus) bus=await prisma.buses.create({data:{cooperativa_id:coop,grupo_id:grupo.id,placa,numero_unidad:`${letra==='A'?900:950}${n}`,color:letra==='A'?'Morado':'Azul',marca_chasis:'Hino',marca_carroceria:'Marcopolo',pisos:1,capacidad:12,anio:2024,imagen_url:'/img/bus-azul.jpg',asientos_bus:{create:Array.from({length:12},(_,i)=>({numero:String(i+1),piso:1,fila:Math.floor(i/4)+1,columna:[1,2,4,5][i%4],categoria:i<4?'VIP':'NORMAL',preferencial:i===5,accesible:i===4,activo:true}))}}});
      buses.push(bus);
    }
    let ruta=await prisma.rutas.findFirst({where:{cooperativa_id:coop,nombre:`DEMO ${letra}: Ambato - Latacunga - Quito`}});
    if (!ruta) { const creada=await crearRuta({nombre:`DEMO ${letra}: Ambato - Latacunga - Quito`,paradas:estaciones.map((t,i)=>({terminal_id:t!.id,minutos_desde_origen:[0,50,140][i]}))},{rol:'cooperativa',coopId:coop});ruta=await prisma.rutas.findUniqueOrThrow({where:{id:creada!.id}}); }
    let frecuencia=await prisma.frecuencias.findFirst({where:{cooperativa_id:coop,codigo:`DEMO-${letra}-${hora.replace(':','')}`}});
    if (!frecuencia) {const creada=await crearFrecuencia({codigo:`DEMO-${letra}-${hora.replace(':','')}`,ruta_id:ruta.id,resolucion_id:resolucion.id,hora_salida:hora,dias:[1,2,3,4,5,6,7]},coop);frecuencia=await prisma.frecuencias.findUniqueOrThrow({where:{id:creada.id}});}
    let creados=0;const omitidos=[];
    for(let dia=1;dia<=7;dia++) {
      const fecha=new Date(+inicio+dia*86400000).toISOString().slice(0,10);
      const r=await programarViajes({frecuencia_id:frecuencia.id,bus_id:buses[(dia-1)%buses.length].id,desde:fecha,hasta:fecha,minutos_cierre:60,fuente_normativa:'TARIFAS DEMO ACADÉMICAS',tarifas:[{origen_orden:1,destino_orden:2,normal:3.25,vip:4.5},{origen_orden:1,destino_orden:3,normal:7.25,vip:10},{origen_orden:2,destino_orden:3,normal:4,vip:5.5}]},usuario.id,coop);
      creados+=r.creados.length;omitidos.push(...r.omitidos);
    }
    salida.push({cooperativa:letra,buses:buses.length,viajesCreados:creados,omitidos});
  }
  console.log(JSON.stringify({mensaje:'Datos de demostración listos. No realizar pagos reales a las cuentas DEMO.',salida},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());

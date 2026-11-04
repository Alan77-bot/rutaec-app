import assert from 'node:assert/strict';import {before,after,describe,it} from 'node:test';import type {Server} from 'node:http';import type {AddressInfo} from 'node:net';
describe('portada con viajes reales',{skip:process.env.RUTAEC_TEST_DB!=='1'},()=>{
  let servidor:Server,base:string;
  const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil'}).format(new Date(Date.now()+2*86400000));
  before(async()=>{const app=(await import('../../app.js')).default;servidor=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;});
  after(async()=>{if(servidor)await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));const {prisma}=await import('../../lib/prisma.js');await prisma.$disconnect();});
  it('devuelve ciudades, cooperativas y tarifas publicadas sin sesión',async()=>{
    const r=await fetch(base+`/api/reservas/portada?origen=Ambato&fecha=${fecha}`);assert.equal(r.status,200);const {data}=await r.json();assert.ok(data.ciudades.some((c:{nombre:string})=>c.nombre==='Ambato'));assert.ok(data.cooperativas.length>=2);assert.ok(data.frecuencias>=2);const quito=data.destinos.find((d:{ciudad:string})=>d.ciudad==='Quito');assert.ok(quito);assert.equal(Number(quito.precio),3.25);assert.equal(quito.moneda,'USD');
  });
  it('una fecha sin viajes no devuelve precios ficticios',async()=>{
    const r=await fetch(base+'/api/reservas/portada?origen=Ambato&fecha=2099-01-01');assert.equal(r.status,200);assert.deepEqual((await r.json()).data.destinos,[]);
  });
  it('rechaza una fecha inexistente',async()=>{assert.equal((await fetch(base+'/api/reservas/portada?origen=Ambato&fecha=2099-02-31')).status,400);});
  it('rechaza parámetros repetidos o vacíos',async()=>{assert.equal((await fetch(base+`/api/reservas/portada?origen=Ambato&origen=Quito&fecha=${fecha}`)).status,400);assert.equal((await fetch(base+`/api/reservas/portada?fecha=${fecha}`)).status,400);});
});

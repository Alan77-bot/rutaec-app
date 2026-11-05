import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compradorPresencial } from './comprador-presencial.js';
test('la venta presencial identifica al comprador sin exigir correo ni cuenta',()=>{
  const c=compradorPresencial({documento:'1800001016',nombres:'Ana',apellidos:'Prueba'});
  assert.equal(c.correo,'');assert.equal(c.documento,'1800001016');
});
test('rechaza documentos incorrectos, nombres vacíos y correos inválidos',()=>{
  assert.throws(()=>compradorPresencial({documento:'1800001017',nombres:'Ana',apellidos:'Prueba'}));
  assert.throws(()=>compradorPresencial({documento:'1800001016',nombres:'',apellidos:'Prueba'}));
  assert.throws(()=>compradorPresencial({documento:'1800001016',nombres:'Ana',apellidos:'Prueba',correo:'invalido'}));
});

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { cedulaValida, documentoPasajero } from './documento.js';

it('valida la cédula con provincia y dígito verificador', () => {
  assert.equal(cedulaValida('1710034065'), true);
  for (const valor of ['1710034066','0000000000','9910034065','17100abc65']) assert.equal(cedulaValida(valor), false);
  assert.throws(() => documentoPasajero({ documento:'1710034066',tipoDocumento:'CEDULA',paisDocumento:'EC' }));
});
it('acepta pasaportes alfanuméricos y normaliza el documento', () => {
  assert.deepEqual(documentoPasajero({ documento:' demo1234 ',tipoDocumento:'PASAPORTE',paisDocumento:'EC' }), { documento:'DEMO1234',tipoDocumento:'PASAPORTE',paisDocumento:'EC' });
});

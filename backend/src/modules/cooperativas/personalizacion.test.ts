import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response, NextFunction } from 'express';
import { validarPersonalizacion, decodificarImagen } from './personalizacion.validacion.js';
import { autorizarCooperativa } from '../../middlewares/cooperativa.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';
import { validarBusqueda } from '../reservas/reservas.validaciones.js';

describe('personalización: validación y aislamiento entre cooperativas', () => {
  const propia = '550e8400-e29b-41d4-a716-446655440000';
  const ajena = '550e8400-e29b-41d4-a716-446655440001';
  function comprobar(rol: string, coopId: string, destino: string, escritura = false) {
    let estado = 200, permitido = false;
    const req = { params: { id: destino } } as unknown as Request;
    const res = { locals: { sesion: { id: propia, rol, coopId } }, status(codigo: number) { estado = codigo; return this; }, json() {} } as unknown as Response;
    const siguiente: NextFunction = () => { permitido = true; };
    if (escritura) autorizarRoles('cooperativa')(req, res, () => autorizarCooperativa('id')(req, res, siguiente));
    else autorizarCooperativa('id')(req, res, siguiente);
    return { estado, permitido };
  }
  it('permite guardar al gerente de la cooperativa', () => assert.deepEqual(comprobar('cooperativa', propia, propia, true), { estado: 200, permitido: true }));
  it('impide guardar al gerente de otra cooperativa', () => assert.deepEqual(comprobar('cooperativa', propia, ajena, true), { estado: 403, permitido: false }));
  it('impide modificar al oficinista aunque pertenezca a la cooperativa', () => assert.deepEqual(comprobar('oficinista', propia, propia, true), { estado: 403, permitido: false }));
  it('rechaza cambios de nombre, propietario o referencias de archivos', () => {
    for (const campo of ['nombre_comercial', 'cooperativa_id', 'logo_archivo_id', 'portada_archivo_id', '__proto__']) {
      assert.throws(() => validarPersonalizacion(JSON.parse(`{"${campo}":"valor"}`)));
    }
  });
  it('valida colores y enlaces y conserva los contactos obligatorios', () => {
    for (const datos of [{ color_primario: 'red' }, { instagram: 'javascript:alert(1)' }, { correo: 'invalido' }, { telefono: '' }, { direccion: ' ' }]) assert.throws(() => validarPersonalizacion(datos));
    assert.deepEqual(validarPersonalizacion({ color_primario: '#123abc', sitio_web: ' https://ejemplo.com ' }), { color_primario: '#123abc', sitio_web: 'https://ejemplo.com' });
  });
  it('rechaza archivos falsos y datos de más de 2 MB', () => {
    assert.throws(() => decodificarImagen('data:image/png;base64,' + Buffer.from('<script/>').toString('base64')));
    assert.throws(() => decodificarImagen('data:image/svg+xml;base64,PHN2Zy8+'));
    const grande = Buffer.alloc(2 * 1024 * 1024 + 1); Buffer.from([137,80,78,71,13,10,26,10]).copy(grande);
    assert.throws(() => decodificarImagen('data:image/png;base64,' + grande.toString('base64')));
  });
  it('acepta un PNG real', () => {
    const imagen = decodificarImagen('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
    assert.equal(imagen.tipo, 'png'); assert.ok(imagen.datos.length > 8);
  });
  it('valida el filtro público sin confundirlo con autorización de personal', () => {
    const consulta = { origen: 'Ambato', destino: 'Quito', fecha: '2099-01-01', cooperativa: propia };
    const resultado = validarBusqueda(consulta);
    assert.ok(resultado.ok);
    if (resultado.ok) assert.equal(resultado.datos.cooperativa, propia);
    assert.equal(validarBusqueda({ ...consulta, cooperativa: [propia, ajena] }).ok, false);
    assert.equal(validarBusqueda({ ...consulta, cooperativa: "' OR TRUE --" }).ok, false);
  });
});

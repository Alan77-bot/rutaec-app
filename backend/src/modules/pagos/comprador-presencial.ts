import { documentoPasajero } from '../reservas/documento.js';
export function compradorPresencial(valor: unknown) {
  if (!valor || typeof valor !== 'object') throw new Error('Introduce los datos del comprador.');
  const d=valor as Record<string,unknown>;
  const identidad=documentoPasajero({documento:d.documento,tipoDocumento:d.tipoDocumento??'CEDULA',paisDocumento:d.paisDocumento??'EC'});
  const nombre=(clave:string)=>{const v=d[clave];if(typeof v!=='string'||v.trim().length<2||v.trim().length>100)throw new Error(`Revisa ${clave}.`);return v.trim();};
  const correo=typeof d.correo==='string'?d.correo.trim().toLowerCase():'';
  if(correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))throw new Error('Correo inválido.');
  return {...identidad,nombres:nombre('nombres'),apellidos:nombre('apellidos'),correo};
}

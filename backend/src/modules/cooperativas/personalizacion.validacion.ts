export class ErrorPersonalizacion extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

const campos = ['color_primario', 'color_secundario', 'correo', 'telefono', 'direccion', 'sitio_web', 'facebook', 'instagram', 'whatsapp', 'logo', 'fotografia'];

export function validarPersonalizacion(cuerpo: unknown): Record<string, string> {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new ErrorPersonalizacion(400, 'Debes enviar la personalización.');
  const entrada = cuerpo as Record<string, unknown>;
  if (!Object.keys(entrada).length || Object.keys(entrada).some(c => !campos.includes(c))) throw new ErrorPersonalizacion(400, 'La solicitud contiene campos no permitidos.');
  const datos: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(entrada)) {
    if (typeof valor !== 'string') throw new ErrorPersonalizacion(400, `El campo ${campo} debe ser texto.`);
    const limpio = valor.trim();
    if (!['logo', 'fotografia'].includes(campo) && limpio.length > 500) throw new ErrorPersonalizacion(400, `El campo ${campo} es demasiado largo.`);
    if (campo.startsWith('color_') && !/^#[0-9a-f]{6}$/i.test(limpio)) throw new ErrorPersonalizacion(400, 'El color debe tener formato hexadecimal de seis dígitos.');
    if (['correo', 'telefono', 'direccion'].includes(campo) && !limpio) throw new ErrorPersonalizacion(400, `El campo ${campo} es obligatorio.`);
    if (campo === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new ErrorPersonalizacion(400, 'El correo no es válido.');
    if (['sitio_web', 'facebook', 'instagram'].includes(campo) && limpio) {
      try { if (!['https:', 'http:'].includes(new URL(limpio).protocol)) throw new Error(); }
      catch { throw new ErrorPersonalizacion(400, `El enlace de ${campo} no es válido.`); }
    }
    datos[campo] = limpio;
  }
  return datos;
}

export function decodificarImagen(valor: string) {
  const resultado = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(valor);
  if (!resultado) throw new ErrorPersonalizacion(400, 'Selecciona una imagen PNG, JPG o WEBP.');
  const datos = Buffer.from(resultado[2]!, 'base64');
  const tipo = resultado[1]!;
  const valida = tipo === 'png' ? datos.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : tipo === 'jpeg' ? datos[0] === 255 && datos[1] === 216 && datos[2] === 255
    : datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP';
  if (!valida || !datos.length || datos.length > 2 * 1024 * 1024) throw new ErrorPersonalizacion(400, 'La imagen debe ser válida y pesar como máximo 2 MB.');
  return { datos, tipo, extension: tipo === 'jpeg' ? 'jpg' : tipo };
}

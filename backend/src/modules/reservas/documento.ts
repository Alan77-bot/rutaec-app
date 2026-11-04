export function cedulaValida(valor: string): boolean {
  if (!/^\d{10}$/.test(valor) || /^0+$/.test(valor)) return false;
  const provincia = Number(valor.slice(0,2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30) || Number(valor[2]) > 5) return false;
  const suma = valor.slice(0,9).split('').reduce((total,n,i) => { const x = Number(n) * (i % 2 === 0 ? 2 : 1); return total + (x > 9 ? x - 9 : x); },0);
  return (10 - suma % 10) % 10 === Number(valor[9]);
}
export function documentoPasajero(entrada:{documento?:unknown;tipoDocumento?:unknown;paisDocumento?:unknown}){
  const tipoDocumento=String(entrada.tipoDocumento??'CEDULA').toUpperCase();
  const paisDocumento=String(entrada.paisDocumento??'EC').toUpperCase();
  const documento=String(entrada.documento??'').trim().toUpperCase();
  if(!['CEDULA','PASAPORTE'].includes(tipoDocumento)||!/^[A-Z]{2}$/.test(paisDocumento))throw new Error('Tipo o país de documento inválidos.');
  if(tipoDocumento==='CEDULA'?(paisDocumento!=='EC'||!/^\d{10}$/.test(documento)):!/^[A-Z0-9]{4,20}$/.test(documento))throw new Error('Revisa la cédula ecuatoriana o el número de pasaporte (4 a 20 letras o números).');
  if (tipoDocumento === 'CEDULA' && !cedulaValida(documento)) throw new Error('La cédula no supera la validación de su dígito verificador.');
  return {tipoDocumento,paisDocumento,documento};
}

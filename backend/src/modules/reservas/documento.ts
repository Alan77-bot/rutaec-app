export function documentoPasajero(entrada:{documento?:unknown;tipoDocumento?:unknown;paisDocumento?:unknown}){
  const tipoDocumento=String(entrada.tipoDocumento??'CEDULA').toUpperCase();
  const paisDocumento=String(entrada.paisDocumento??'EC').toUpperCase();
  const documento=String(entrada.documento??'').trim().toUpperCase();
  if(!['CEDULA','PASAPORTE'].includes(tipoDocumento)||!/^[A-Z]{2}$/.test(paisDocumento))throw new Error('Tipo o país de documento inválidos.');
  if(tipoDocumento==='CEDULA'?(paisDocumento!=='EC'||!/^\d{10}$/.test(documento)):!/^[A-Z0-9]{4,20}$/.test(documento))throw new Error('Revisa la cédula ecuatoriana o el número de pasaporte (4 a 20 letras o números).');
  return {tipoDocumento,paisDocumento,documento};
}

const clave=(piso,fila,columna)=>`${piso}-${fila}-${columna}`;
export function generarAsientos(capacidad, configuraciones, equilibrar = true) {
  const resultado = [];
  let numero = 1;

  const cantidades = configuraciones.map((_,i) => Math.floor(capacidad/configuraciones.length) + (i < capacidad%configuraciones.length ? 1 : 0));
  for (const [indice, config] of configuraciones.entries()) {
    let usados = 0;
    const especiales = new Set(
      config.espacios.map((e) => clave(config.piso, e.fila, e.columna))
    );

    for (let fila = 1; fila <= config.filas; fila++) {
      for (let columna = 1; columna <= config.columnas; columna++) {
        if (columna === config.pasillo) continue;
        if (especiales.has(clave(config.piso, fila, columna))) continue;
        if (numero > capacidad) return resultado;
        if (equilibrar && usados >= cantidades[indice]) continue;
        usados++;

        resultado.push({
          numero: String(numero++),
          piso: config.piso,
          fila,
          columna,
          categoria: "NORMAL",
          preferencial: false,
          accesible: false,
          activo: true,
        });
      }
    }
  }

  return resultado;
}

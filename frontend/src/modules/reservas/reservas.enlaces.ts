export interface DatosEnlaceCompra {
  origen: string;
  destino: string;
  fecha: string;
  pasajeros: number;
}

/**
 * Enlace a la pantalla de compra de un viaje. Los datos de la busqueda viajan
 * en la URL (codificados, por si una ciudad tiene espacios, tildes o simbolos)
 * para que la compra pueda volver a los resultados sin perderlos.
 */
export function urlCompra(viajeId: string, datos: DatosEnlaceCompra): string {
  const consulta = new URLSearchParams({
    origen: datos.origen,
    destino: datos.destino,
    fecha: datos.fecha,
    n: String(datos.pasajeros),
  });

  return `/comprar/${encodeURIComponent(viajeId)}?${consulta.toString()}`;
}

/** Enlace de regreso a los resultados con la misma busqueda. */
export function urlResultados(datos: DatosEnlaceCompra): string {
  const consulta = new URLSearchParams({
    origen: datos.origen,
    destino: datos.destino,
    fecha: datos.fecha,
    n: String(datos.pasajeros),
  });

  return `/buscar?${consulta.toString()}`;
}

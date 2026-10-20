import { useCallback, useEffect, useState } from "react";
import { adaptarViaje, type ViajeResultado } from "./services/reservas.adaptador";
import {
  ErrorReservas,
  reservasService,
  type ParametrosBusqueda,
} from "./services/reservas.service";

interface ResultadoBusqueda {
  clave: string;
  viajes: ViajeResultado[];
  error: ErrorReservas | null;
}

/**
 * Consulta los viajes reales de RutaEC cada vez que cambia el origen, el
 * destino o la fecha. Cancela la peticion anterior para que una respuesta
 * lenta no sobrescriba una busqueda mas reciente.
 *
 * "cargando" se deduce: mientras el ultimo resultado guardado no corresponda a
 * la busqueda actual, la pantalla esta esperando respuesta.
 */
export function useBusquedaViajes({ origen, destino, fecha }: ParametrosBusqueda) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<ResultadoBusqueda | null>(null);

  const clave = `${origen}|${destino}|${fecha}|${intento}`;

  useEffect(() => {
    const control = new AbortController();

    reservasService
      .buscarViajes({ origen, destino, fecha }, control.signal)
      .then((datos) => {
        setResultado({
          clave,
          viajes: datos.map((viaje) => adaptarViaje(viaje, { origen, destino })),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;

        setResultado({
          clave,
          viajes: [],
          error:
            error instanceof ErrorReservas
              ? error
              : new ErrorReservas("Ocurrió un error inesperado al buscar viajes.", 0),
        });
      });

    return () => control.abort();
  }, [clave, origen, destino, fecha]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  const cargando = resultado?.clave !== clave;

  return {
    viajes: cargando ? [] : resultado.viajes,
    error: cargando ? null : resultado.error,
    cargando,
    reintentar,
  };
}

import { useCallback, useEffect, useState } from "react";
import { adaptarViaje, type ViajeResultado } from "./services/reservas.adaptador";
import {
  ErrorReservas,
  reservasService,
  type AsientoApi,
  type ParametrosDisponibilidad,
} from "./services/reservas.service";

export interface DisponibilidadViaje {
  viaje: ViajeResultado;
  asientos: AsientoApi[];
}

interface ResultadoDisponibilidad {
  clave: string;
  datos: DisponibilidadViaje | null;
  error: ErrorReservas | null;
}

/**
 * Carga el viaje y el estado de cada asiento para el tramo del pasajero.
 * Cancela la peticion anterior si cambian los parametros, y "cargando" se
 * deduce igual que en la busqueda: mientras el ultimo resultado guardado no
 * corresponda a la consulta actual, la pantalla esta esperando respuesta.
 */
export function useDisponibilidad({ viajeId, origen, destino }: ParametrosDisponibilidad) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<ResultadoDisponibilidad | null>(null);

  const clave = `${viajeId}|${origen}|${destino}|${intento}`;

  useEffect(() => {
    const control = new AbortController();

    reservasService
      .obtenerDisponibilidad({ viajeId, origen, destino }, control.signal)
      .then((respuesta) => {
        setResultado({
          clave,
          datos: {
            viaje: adaptarViaje(respuesta.viaje, { origen, destino }),
            asientos: respuesta.asientos,
          },
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;

        setResultado({
          clave,
          datos: null,
          error:
            error instanceof ErrorReservas
              ? error
              : new ErrorReservas("Ocurrió un error inesperado al cargar los asientos.", 0),
        });
      });

    return () => control.abort();
  }, [clave, viajeId, origen, destino]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  const cargando = resultado?.clave !== clave;

  return {
    disponibilidad: cargando ? null : resultado.datos,
    error: cargando ? null : resultado.error,
    cargando,
    recargar,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { adaptarViaje, type ViajeResultado } from "./services/reservas.adaptador";
import {
  ErrorReservas,
  reservasService,
  type AsientoApi,
  type DisponibilidadApi,
  type ParadaViajeApi,
  type ParametrosDisponibilidad,
  type ResumenAsientosApi,
} from "./services/reservas.service";

// Cada cuanto se vuelve a consultar el estado de los asientos mientras la
// persona elige. Una reserva de otra persona dura 5 minutos, asi que un
// retraso de pocos segundos es aceptable.
const INTERVALO_REFRESCO_MS = 8000;

export interface DisponibilidadViaje {
  viaje: ViajeResultado;
  recorrido: ParadaViajeApi[];
  resumen: ResumenAsientosApi;
  asientos: AsientoApi[];
}

interface ResultadoDisponibilidad {
  clave: string;
  datos: DisponibilidadViaje | null;
  error: ErrorReservas | null;
}

interface OpcionesDisponibilidad {
  // Se llama con los datos frescos despues de cada refresco (automatico o manual).
  alActualizar?: (datos: DisponibilidadViaje) => void;
}

// Cuenta los asientos de cada estado cuando la API no envia el resumen.
function resumirAsientos(asientos: AsientoApi[]): ResumenAsientosApi {
  const cuenta = (estado: AsientoApi["estado"]) =>
    asientos.filter((a) => a.estado === estado).length;

  return {
    total: asientos.length,
    libres: cuenta("LIBRE"),
    ocupados: cuenta("OCUPADO"),
    retenidos: cuenta("RETENIDO"),
    no_vendibles: cuenta("NO_VENDIBLE"),
  };
}

// La pantalla no debe romperse si la API trae menos datos (por ejemplo, un
// backend que todavia no se actualizo): recorrido y resumen tienen respaldo.
function datosDe(respuesta: DisponibilidadApi, origen: string, destino: string): DisponibilidadViaje {
  return {
    viaje: adaptarViaje(respuesta.viaje, { origen, destino }),
    recorrido: respuesta.recorrido ?? [],
    resumen: respuesta.resumen ?? resumirAsientos(respuesta.asientos),
    asientos: respuesta.asientos,
  };
}

function errorDe(error: unknown): ErrorReservas {
  return error instanceof ErrorReservas
    ? error
    : new ErrorReservas("Ocurrió un error inesperado al cargar los asientos.", 0);
}

/**
 * Carga el viaje y el estado de cada asiento para el tramo del pasajero.
 * Cancela la peticion anterior si cambian los parametros, y "cargando" se
 * deduce igual que en la busqueda: mientras el ultimo resultado guardado no
 * corresponda a la consulta actual, la pantalla esta esperando respuesta.
 *
 * Despues de la primera carga se actualiza sola cada pocos segundos (si la
 * pestana esta visible) y al volver a ella; esos refrescos son silenciosos:
 * no muestran "cargando" ni borran los asientos si una consulta falla. Solo si
 * el viaje deja de estar a la venta (404) la pantalla pasa a mostrar el error.
 */
export function useDisponibilidad(
  { viajeId, origen, destino }: ParametrosDisponibilidad,
  { alActualizar }: OpcionesDisponibilidad = {}
) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<ResultadoDisponibilidad | null>(null);

  // Siempre se llama la version mas reciente de alActualizar, sin reiniciar el
  // temporizador cada vez que la pantalla cambia.
  const alActualizarRef = useRef(alActualizar);
  useEffect(() => {
    alActualizarRef.current = alActualizar;
  });

  const clave = `${viajeId}|${origen}|${destino}|${intento}`;

  useEffect(() => {
    const control = new AbortController();

    reservasService
      .obtenerDisponibilidad({ viajeId, origen, destino }, control.signal)
      .then((respuesta) => {
        setResultado({
          clave,
          datos: datosDe(respuesta, origen, destino),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        setResultado({ clave, datos: null, error: errorDe(error) });
      });

    return () => control.abort();
  }, [clave, viajeId, origen, destino]);

  const cargando = resultado?.clave !== clave;
  const listo = !cargando && resultado.datos !== null;

  // Consulta de nuevo y actualiza los asientos; devuelve los datos frescos.
  const refrescar = useCallback(
    async (signal?: AbortSignal): Promise<DisponibilidadViaje> => {
      const respuesta = await reservasService.obtenerDisponibilidad(
        { viajeId, origen, destino },
        signal
      );
      const datos = datosDe(respuesta, origen, destino);

      setResultado((anterior) =>
        anterior && anterior.clave === clave ? { clave, datos, error: null } : anterior
      );
      alActualizarRef.current?.(datos);

      return datos;
    },
    [clave, viajeId, origen, destino]
  );

  useEffect(() => {
    if (!listo) return;

    const control = new AbortController();

    const actualizar = () => {
      if (document.hidden) return;

      refrescar(control.signal).catch((error: unknown) => {
        if (control.signal.aborted) return;

        // Si el viaje ya no esta a la venta hay que avisarlo; un fallo de red
        // pasajero no debe borrar los asientos que la persona esta viendo.
        if (error instanceof ErrorReservas && error.estado === 404) {
          setResultado({ clave, datos: null, error });
        }
      });
    };

    const temporizador = setInterval(actualizar, INTERVALO_REFRESCO_MS);
    document.addEventListener("visibilitychange", actualizar);

    return () => {
      control.abort();
      clearInterval(temporizador);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [listo, clave, refrescar]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return {
    disponibilidad: cargando ? null : resultado.datos,
    error: cargando ? null : resultado.error,
    cargando,
    recargar,
    refrescar,
  };
}

import { useEffect, useState } from "react";
import { ErrorReservas, reservasService } from "./services/reservas.service";

interface ResultadoCiudades {
  ciudades: string[];
  error: ErrorReservas | null;
}

/**
 * Nombres de las ciudades por las que pasa algun viaje disponible, ordenados.
 * Llenan los selectores de origen y destino con datos reales de RutaEC.
 */
export function useCiudades() {
  const [resultado, setResultado] = useState<ResultadoCiudades | null>(null);

  useEffect(() => {
    const control = new AbortController();

    reservasService
      .listarCiudades(control.signal)
      .then((datos) => {
        setResultado({ ciudades: datos.map((c) => c.nombre), error: null });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;

        setResultado({
          ciudades: [],
          error:
            error instanceof ErrorReservas
              ? error
              : new ErrorReservas("No se pudieron cargar las ciudades.", 0),
        });
      });

    return () => control.abort();
  }, []);

  return {
    ciudades: resultado?.ciudades ?? [],
    error: resultado?.error ?? null,
    cargando: resultado === null,
  };
}

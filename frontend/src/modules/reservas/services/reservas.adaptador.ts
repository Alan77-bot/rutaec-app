import type { ViajeApi } from "./reservas.service";

const ZONA_HORARIA = "America/Guayaquil";

export interface ParadaResultado {
  orden: number;
  terminal: string;
  hora: string;
}

export interface ViajeResultado {
  id: string;
  origen: string;
  destino: string;
  origenTerminal: string;
  destinoTerminal: string;
  horaSalida: string;
  horaLlegada: string;
  duracion: string;
  precio: number | null;
  precioVip: number | null;
  moneda: string;
  libres: number;
  paradasIntermedias: number;
  tipoViaje: "directa" | "compartida";
  cierreVentas: string;
  paradas: ParadaResultado[];
  coop: { id: string; nombre: string; color: string; logo: string | null };
  bus: {
    tipo: "normal" | "dospisos";
    numero: string;
    placa: string;
    chasis: string;
    carroceria: string;
    capacidad: number;
    imagen: string | null;
  };
}

const formatoHora = new Intl.DateTimeFormat("es-EC", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatearHora(iso: string): string {
  return formatoHora.format(new Date(iso));
}

export function formatearDuracion(desde: string, hasta: string): string {
  const minutos = Math.max(
    0,
    Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000)
  );
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

function importeDe(viaje: ViajeApi, categoria: "NORMAL" | "VIP"): number | null {
  const tarifa = viaje.tarifas.find((t) => t.categoria === categoria);
  return tarifa ? Number(tarifa.importe) : null;
}

// En el origen se muestra la hora de salida; en el resto, la de llegada.
function adaptarParadas(viaje: ViajeApi): ParadaResultado[] {
  return (viaje.paradas ?? []).map((parada, indice) => ({
    orden: parada.orden,
    terminal: parada.terminal,
    hora: formatearHora(indice === 0 ? parada.salida : parada.llegada),
  }));
}

/**
 * Convierte un viaje de la API de RutaEC al formato que consumen las tarjetas
 * de resultados. origen y destino son las ciudades buscadas; el nombre de cada
 * terminal viaja aparte.
 */
export function adaptarViaje(
  viaje: ViajeApi,
  ciudades: { origen: string; destino: string }
): ViajeResultado {
  const tramos = viaje.destino_orden - viaje.origen_orden;
  const normal = importeDe(viaje, "NORMAL");
  const vip = importeDe(viaje, "VIP");

  return {
    id: viaje.viaje_id,
    origen: ciudades.origen,
    destino: ciudades.destino,
    origenTerminal: viaje.origen_terminal,
    destinoTerminal: viaje.destino_terminal,
    horaSalida: formatearHora(viaje.salida),
    horaLlegada: formatearHora(viaje.llegada),
    duracion: formatearDuracion(viaje.salida, viaje.llegada),
    precio: normal ?? vip,
    precioVip: vip,
    moneda: viaje.tarifas[0]?.moneda ?? "USD",
    libres: viaje.cupos_disponibles,
    paradasIntermedias: Math.max(0, tramos - 1),
    tipoViaje: tramos > 1 ? "compartida" : "directa",
    cierreVentas: viaje.cierre_ventas,
    paradas: adaptarParadas(viaje),
    coop: {
      id: viaje.cooperativa.id,
      nombre: viaje.cooperativa.nombre,
      color: viaje.cooperativa.color_primario,
      logo: null,
    },
    bus: {
      tipo: viaje.bus.pisos === 2 ? "dospisos" : "normal",
      numero: viaje.bus.numero_unidad,
      placa: viaje.bus.placa,
      chasis: viaje.bus.marca_chasis,
      carroceria: viaje.bus.marca_carroceria,
      capacidad: viaje.bus.capacidad,
      imagen: viaje.bus.imagen_url,
    },
  };
}

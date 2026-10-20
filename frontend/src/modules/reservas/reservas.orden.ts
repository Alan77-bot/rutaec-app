import type { ViajeResultado } from "./services/reservas.adaptador";

export type CriterioOrden = "hora" | "precio-menor" | "precio-mayor" | "asientos";
export type FranjaHoraria = "todos" | "madrugada" | "manana" | "tarde" | "noche";

export const OPCIONES_ORDEN: { valor: CriterioOrden; nombre: string }[] = [
  { valor: "hora", nombre: "Hora de salida" },
  { valor: "precio-menor", nombre: "Precio: menor a mayor" },
  { valor: "precio-mayor", nombre: "Precio: mayor a menor" },
  { valor: "asientos", nombre: "Más asientos libres" },
];

export const OPCIONES_FRANJA: { valor: FranjaHoraria; nombre: string }[] = [
  { valor: "todos", nombre: "Cualquiera" },
  { valor: "madrugada", nombre: "Madrugada (00:00 - 05:59)" },
  { valor: "manana", nombre: "Mañana (06:00 - 11:59)" },
  { valor: "tarde", nombre: "Tarde (12:00 - 17:59)" },
  { valor: "noche", nombre: "Noche (18:00 - 23:59)" },
];

/** Franja del dia a la que pertenece una hora con formato HH:mm. */
export function franjaDe(hora: string): Exclude<FranjaHoraria, "todos"> {
  const h = Number(hora.slice(0, 2));
  if (h < 6) return "madrugada";
  if (h < 12) return "manana";
  if (h < 18) return "tarde";
  return "noche";
}

export function filtrarPorFranja(
  viajes: ViajeResultado[],
  franja: FranjaHoraria
): ViajeResultado[] {
  if (franja === "todos") return viajes;
  return viajes.filter((v) => franjaDe(v.horaSalida) === franja);
}

// Un viaje sin tarifa nunca debe quedar primero al ordenar por precio.
const precioOrdenable = (v: ViajeResultado, vacio: number) => v.precio ?? vacio;

export function ordenarViajes(
  viajes: ViajeResultado[],
  criterio: CriterioOrden
): ViajeResultado[] {
  const copia = [...viajes];

  switch (criterio) {
    case "precio-menor":
      return copia.sort(
        (a, b) =>
          precioOrdenable(a, Infinity) - precioOrdenable(b, Infinity) ||
          a.horaSalida.localeCompare(b.horaSalida)
      );
    case "precio-mayor":
      return copia.sort(
        (a, b) =>
          precioOrdenable(b, -Infinity) - precioOrdenable(a, -Infinity) ||
          a.horaSalida.localeCompare(b.horaSalida)
      );
    case "asientos":
      return copia.sort(
        (a, b) => b.libres - a.libres || a.horaSalida.localeCompare(b.horaSalida)
      );
    default:
      return copia.sort((a, b) => a.horaSalida.localeCompare(b.horaSalida));
  }
}

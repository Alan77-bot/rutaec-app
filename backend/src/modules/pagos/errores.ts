// Error de negocio del modulo de pagos: lleva el codigo HTTP que debe responderse.
export class ErrorPago extends Error {
  estado: number;
  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

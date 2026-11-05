-- Aplicar también en bases existentes. No elimina ni convierte pagos anteriores.
BEGIN;
ALTER TABLE rutaec.detalle_compra ADD COLUMN IF NOT EXISTS politica_presencial_id uuid REFERENCES rutaec.politicas_descuento(id);
ALTER TABLE rutaec.detalle_compra ADD COLUMN IF NOT EXISTS verificado_presencial_por uuid REFERENCES rutaec.usuarios(id);
ALTER TABLE rutaec.detalle_compra DROP CONSTRAINT IF EXISTS detalle_compra_check2;
ALTER TABLE rutaec.detalle_compra ADD CONSTRAINT detalle_compra_check2 CHECK (
  descuento=0 OR validacion_descuento_id IS NOT NULL
  OR (politica_presencial_id IS NOT NULL AND verificado_presencial_por IS NOT NULL)
);
ALTER TABLE rutaec.pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE rutaec.pagos ADD CONSTRAINT pagos_metodo_check CHECK (metodo IN ('TRANSFERENCIA','DEPOSITO','TARJETA','EFECTIVO'));
ALTER TABLE rutaec.pagos DROP CONSTRAINT IF EXISTS pagos_check;
ALTER TABLE rutaec.pagos ADD CONSTRAINT pagos_check CHECK (
  (metodo='TARJETA' AND proveedor IS NOT NULL AND cuenta_bancaria_id IS NULL)
  OR (metodo IN ('DEPOSITO','TRANSFERENCIA') AND cuenta_bancaria_id IS NOT NULL)
  OR (metodo='EFECTIVO' AND proveedor='CAJA_PRESENCIAL' AND cuenta_bancaria_id IS NULL)
);
COMMIT;

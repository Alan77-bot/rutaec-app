CREATE TABLE IF NOT EXISTS rutaec.configuracion_aplicacion (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS rutaec.correos_desarrollo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario text NOT NULL,
  asunto text NOT NULL,
  texto text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

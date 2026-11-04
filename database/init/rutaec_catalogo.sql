-- Catálogo inicial de ciudades. No crea terminales ni operaciones de prueba.
BEGIN;
INSERT INTO rutaec.ciudades (pais, provincia, nombre)
VALUES
  ('EC', 'Pichincha', 'Quito'),
  ('EC', 'Guayas', 'Guayaquil'),
  ('EC', 'Azuay', 'Cuenca'),
  ('EC', 'Tungurahua', 'Ambato'),
  ('EC', 'Cotopaxi', 'Latacunga'),
  ('EC', 'Chimborazo', 'Riobamba'),
  ('EC', 'Loja', 'Loja'),
  ('EC', 'Santo Domingo de los Tsáchilas', 'Santo Domingo')
ON CONFLICT (pais, provincia, nombre) DO NOTHING;

-- Las terminales se registran con datos verificados desde Administración.
COMMIT;

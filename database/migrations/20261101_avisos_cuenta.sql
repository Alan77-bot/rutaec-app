-- Migración aditiva y revisable. NO ejecutada por Codex. Aplicar en la base
-- autorizada antes de esperar avisos de cambios de correo/contraseña.
BEGIN;
CREATE OR REPLACE FUNCTION rutaec.notificar_cambio_cuenta() RETURNS trigger
LANGUAGE plpgsql SET search_path TO rutaec,public AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    PERFORM encolar_evento('CUENTA_CLAVE_CAMBIADA',NEW.id,NULL,'cuenta-clave:'||gen_random_uuid(),jsonb_build_object('usuario_id',NEW.id));
  END IF;
  IF NEW.correo IS DISTINCT FROM OLD.correo THEN
    PERFORM encolar_evento('CUENTA_CORREO_CAMBIADO',NEW.id,NULL,'cuenta-correo:'||gen_random_uuid(),jsonb_build_object('usuario_id',NEW.id,'correo_anterior',OLD.correo));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS usuarios_aviso_cambio_cuenta ON rutaec.usuarios;
CREATE TRIGGER usuarios_aviso_cambio_cuenta AFTER UPDATE OF password_hash,correo ON rutaec.usuarios FOR EACH ROW EXECUTE FUNCTION rutaec.notificar_cambio_cuenta();
COMMIT;

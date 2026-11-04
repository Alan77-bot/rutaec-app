--
-- PostgreSQL database dump
--

\restrict gcGIbURvzWX0XbjPpp3QgA7zQTkOTYzdz6e2U3v00pj54EAraA79qB2QxhgOFC4

-- Dumped from database version 18.6 (c021049)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: rutaec; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rutaec;


--
-- Name: actor_actual(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.actor_actual() RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE a uuid;
BEGIN
 a := nullif(current_setting('app.usuario_id',true),'')::uuid;
 IF a IS NULL OR NOT EXISTS(SELECT 1 FROM usuarios WHERE id=a AND activo) THEN
  RAISE EXCEPTION 'Se requiere contexto de usuario autenticado activo' USING ERRCODE='42501';
 END IF;
 RETURN a;
END $$;


--
-- Name: auditar_estado(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.auditar_estado() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb; a uuid;
BEGIN
 IF TG_OP='UPDATE' THEN o:=to_jsonb(OLD); END IF;
 a:=nullif(current_setting('app.usuario_id',true),'')::uuid;
 INSERT INTO auditoria(actor_id,cooperativa_id,entidad,entidad_id,accion,estado_anterior,estado_nuevo)
 VALUES(a,(n->>'cooperativa_id')::uuid,TG_TABLE_NAME,(n->>'id')::uuid,TG_OP,o->>'estado',n->>'estado');
 RETURN NEW;
END $$;


--
-- Name: cancelar_reserva(uuid, text); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.cancelar_reserva(p_compra uuid, p_motivo text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE c compras%ROWTYPE; a uuid:=actor_actual();
BEGIN
 SELECT * INTO STRICT c FROM compras WHERE id=p_compra FOR UPDATE;
 IF c.comprador_id <> a AND NOT es_personal(c.cooperativa_id,a) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 IF c.estado NOT IN ('RESERVADA','VENCIDA') OR EXISTS(SELECT 1 FROM pagos WHERE compra_id=c.id AND
  (recibido_en IS NOT NULL OR estado IN ('APROBADO','EN_REVISION','CORRECCION','RECIBIDO_INCIDENCIA'))) THEN
  RAISE EXCEPTION 'Debe solicitar cancelación mediante una incidencia';
 END IF;
 IF nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Indicar motivo'; END IF;
 UPDATE compras SET estado='CANCELADA',motivo=p_motivo,finalizada_en=clock_timestamp() WHERE id=c.id;
 RETURN 'CANCELADA';
END $$;


--
-- Name: confirmar_pago(uuid, numeric, character, text, uuid); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.confirmar_pago(p_pago uuid, p_importe_recibido numeric, p_moneda character, p_referencia text, p_evento uuid DEFAULT NULL::uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE p pagos%ROWTYPE; c compras%ROWTYPE; cid uuid; a uuid; recuperado boolean:=true; v viajes%ROWTYPE;
BEGIN
 SELECT compra_id INTO STRICT cid FROM pagos WHERE id=p_pago;
 SELECT * INTO STRICT c FROM compras WHERE id=cid FOR UPDATE;
 SELECT * INTO STRICT p FROM pagos WHERE id=p_pago FOR UPDATE;
 IF p.metodo <> 'TARJETA' THEN
  a:=exigir_personal(c.cooperativa_id);
  IF NOT EXISTS(SELECT 1 FROM revisiones WHERE pago_id=p.id AND asignado_a=a AND estado='EN_REVISION') THEN
   RAISE EXCEPTION 'Tomar la revisión antes de confirmar'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM eventos_proveedor WHERE id=p_evento AND pago_id=p.id
   AND proveedor=p.proveedor AND firma_verificada AND tipo='PAGO_CONFIRMADO') THEN
   RAISE EXCEPTION 'Falta evento de tarjeta verificado por backend'; END IF;
 END IF;
 IF p.estado IN ('APROBADO','RECIBIDO_INCIDENCIA') THEN RETURN c.estado; END IF;
 IF p_importe_recibido IS NULL OR p_importe_recibido < 0 OR p_moneda IS NULL OR nullif(btrim(p_referencia),'') IS NULL THEN
  RAISE EXCEPTION 'Datos de confirmación incompletos'; END IF;
 UPDATE pagos SET importe_recibido=p_importe_recibido,moneda_recibida=p_moneda,
  referencia_proveedor=CASE WHEN metodo='TARJETA' THEN p_referencia ELSE referencia_proveedor END,
  recibido_en=coalesce(recibido_en,clock_timestamp()),confirmado_por=a WHERE id=p.id;
 IF p_importe_recibido <> c.total OR p_moneda <> c.moneda THEN
  UPDATE pagos SET estado='RECIBIDO_INCIDENCIA',motivo='Importe o moneda no coincide' WHERE id=p.id;
  INSERT INTO incidencias(compra_id,cooperativa_id,pago_id,tipo,descripcion,creado_por)
   VALUES(c.id,c.cooperativa_id,p.id,'IMPORTE_INCORRECTO','Revisar importe recibido y moneda',a);
  -- Se conserva el bloqueo de una compra todavía pendiente para resolver el dinero recibido.
  IF c.estado='RESERVADA' THEN UPDATE compras SET estado='EN_REVISION' WHERE id=c.id; END IF;
  PERFORM encolar_evento('PAGO_INCIDENCIA',p.id,c.cooperativa_id,'pago-incidencia:'||p.id);
  RETURN 'INCIDENCIA';
 END IF;
 IF c.estado='CONFIRMADA' THEN
  UPDATE pagos SET estado='RECIBIDO_INCIDENCIA',motivo='Compra ya pagada' WHERE id=p.id;
  INSERT INTO incidencias(compra_id,cooperativa_id,pago_id,tipo,descripcion,creado_por)
   VALUES(c.id,c.cooperativa_id,p.id,'PAGO_DUPLICADO','Compra ya confirmada por otro pago',a);
  PERFORM encolar_evento('PAGO_INCIDENCIA',p.id,c.cooperativa_id,'pago-incidencia:'||p.id);
  RETURN 'INCIDENCIA';
 END IF;
 SELECT * INTO STRICT v FROM viajes WHERE id=c.viaje_id FOR SHARE;
 IF c.estado IN ('CANCELADA','RECHAZADA','INCIDENCIA') OR v.estado <> 'PUBLICADO'
  OR v.cierre_ventas <= clock_timestamp() THEN recuperado:=false;
 ELSE
  -- Si venció, puede recuperarse solo si todos los tramos siguen disponibles.
  BEGIN
   UPDATE detalle_compra SET estado='CONFIRMADO' WHERE compra_id=c.id;
  EXCEPTION WHEN exclusion_violation THEN recuperado:=false;
  END;
 END IF;
 IF NOT recuperado THEN
  UPDATE pagos SET estado='RECIBIDO_INCIDENCIA',motivo='Pago recibido sin posibilidad de confirmar plazas' WHERE id=p.id;
  INSERT INTO incidencias(compra_id,cooperativa_id,pago_id,tipo,descripcion,creado_por)
   VALUES(c.id,c.cooperativa_id,p.id,'PAGO_TARDIO','Resolver devolución o alternativa; no se emitió boleto',a);
  IF c.estado NOT IN ('CANCELADA','RECHAZADA') THEN
   UPDATE compras SET estado='INCIDENCIA',motivo='Pago recibido sin plazas confirmables' WHERE id=c.id;
  END IF;
  PERFORM encolar_evento('PAGO_INCIDENCIA',p.id,c.cooperativa_id,'pago-incidencia:'||p.id);
  RETURN 'INCIDENCIA';
 END IF;
 UPDATE pagos SET estado='APROBADO',aprobado_en=clock_timestamp() WHERE id=p.id;
 UPDATE compras SET estado='CONFIRMADA',confirmada_en=clock_timestamp(),finalizada_en=NULL WHERE id=c.id;
 IF p_evento IS NOT NULL THEN UPDATE eventos_proveedor SET procesado_en=clock_timestamp() WHERE id=p_evento; END IF;
 PERFORM encolar_evento('PAGO_APROBADO',p.id,c.cooperativa_id,'pago-aprobado:'||p.id,jsonb_build_object('compra_id',c.id));
 PERFORM emitir_boletos(c.id);
 RETURN 'CONFIRMADA';
END $$;


--
-- Name: corregir_comprobante(uuid, uuid, text, date, numeric); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.corregir_comprobante(p_pago uuid, p_archivo uuid, p_referencia text, p_fecha date, p_importe numeric) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE p pagos%ROWTYPE; c compras%ROWTYPE; a uuid:=actor_actual(); cid uuid;
BEGIN
 SELECT compra_id INTO STRICT cid FROM pagos WHERE id=p_pago;
 SELECT * INTO STRICT c FROM compras WHERE id=cid FOR UPDATE;
 SELECT * INTO STRICT p FROM pagos WHERE id=p_pago FOR UPDATE;
 IF c.comprador_id <> a AND NOT es_personal(c.cooperativa_id,a) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 IF p.estado <> 'CORRECCION' OR c.estado <> 'EN_REVISION' THEN RAISE EXCEPTION 'No se solicitó corrección'; END IF;
 IF NOT EXISTS(SELECT 1 FROM archivos WHERE id=p_archivo AND propietario_id=a AND finalidad='COMPROBANTE'
  AND privado AND estado='DISPONIBLE' AND (cooperativa_id IS NULL OR cooperativa_id=c.cooperativa_id)) THEN RAISE EXCEPTION 'Archivo no autorizado'; END IF;
 INSERT INTO comprobantes_pago(pago_id,archivo_id,numero_referencia,fecha_operacion,importe_declarado)
 VALUES(p.id,p_archivo,p_referencia,p_fecha,p_importe);
 UPDATE pagos SET estado='EN_REVISION' WHERE id=p.id;
 UPDATE revisiones SET estado=CASE WHEN asignado_a IS NULL THEN 'PENDIENTE' ELSE 'EN_REVISION' END WHERE pago_id=p.id;
 PERFORM encolar_evento('COMPROBANTE_CORREGIDO',p.id,p.cooperativa_id,'correccion:'||p_archivo,jsonb_build_object('compra_id',c.id));
END $$;


--
-- Name: crear_intento_tarjeta(uuid, text, uuid); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.crear_intento_tarjeta(p_compra uuid, p_proveedor text, p_idempotencia uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE c compras%ROWTYPE; a uuid:=actor_actual(); x pagos%ROWTYPE; pago uuid;
BEGIN
 SELECT * INTO STRICT c FROM compras WHERE id=p_compra FOR UPDATE;
 IF a <> c.comprador_id AND NOT es_personal(c.cooperativa_id,a) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM pagos WHERE clave_idempotencia=p_idempotencia;
 IF FOUND THEN
  IF x.compra_id <> c.id OR x.metodo <> 'TARJETA' OR x.proveedor IS DISTINCT FROM p_proveedor THEN
   RAISE EXCEPTION 'Clave idempotente reutilizada'; END IF;
  RETURN x.id;
 END IF;
 IF c.estado <> 'RESERVADA' OR c.vence_en <= clock_timestamp() THEN RAISE EXCEPTION 'Reserva no vigente'; END IF;
 INSERT INTO pagos(compra_id,cooperativa_id,metodo,importe,proveedor,clave_idempotencia)
 VALUES(c.id,c.cooperativa_id,'TARJETA',c.total,p_proveedor,p_idempotencia) RETURNING id INTO pago;
 RETURN pago;
END $$;


--
-- Name: emitir_boletos(uuid); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.emitir_boletos(p_compra uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE c compras%ROWTYPE; co cooperativas%ROWTYPE; n integer;
BEGIN
 SELECT * INTO STRICT c FROM compras WHERE id=p_compra FOR UPDATE;
 IF c.estado <> 'CONFIRMADA' OR NOT EXISTS(SELECT 1 FROM pagos WHERE compra_id=c.id
  AND estado='APROBADO' AND importe_recibido=c.total AND moneda_recibida=c.moneda) THEN
  RAISE EXCEPTION 'No emitir sin compra y pago confirmados'; END IF;
 SELECT * INTO STRICT co FROM cooperativas WHERE id=c.cooperativa_id;
 INSERT INTO boletos(detalle_id,compra_id,datos_emision)
 SELECT d.id,c.id,jsonb_build_object(
  'cooperativa',co.nombre_comercial,'color_primario',co.color_primario,'color_secundario',co.color_secundario,
  'logo_archivo_id',co.logo_archivo_id,'pasajero',d.pasajero_snapshot-'numero_documento'-'fecha_nacimiento',
  'asiento',d.asiento_snapshot,'origen',o.nombre_snapshot,'destino',z.nombre_snapshot,
  'salida',o.salida,'llegada',z.llegada,'placa',b.placa,'unidad',b.numero_unidad,
  'precio_base',d.precio_base,'descuento',d.descuento,'importe',d.importe,'moneda',c.moneda)
 FROM detalle_compra d JOIN viajes v ON v.id=d.viaje_id JOIN buses b ON b.id=v.bus_id
 JOIN paradas_viaje o ON o.viaje_id=d.viaje_id AND o.orden=d.origen_orden
 JOIN paradas_viaje z ON z.viaje_id=d.viaje_id AND z.orden=d.destino_orden
 WHERE d.compra_id=c.id AND d.estado='CONFIRMADO'
 ON CONFLICT(detalle_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM encolar_evento('BOLETOS_EMITIDOS',c.id,c.cooperativa_id,'boletos:'||c.id,
  jsonb_build_object('compra_id',c.id,'correo',c.correo_destino));
 RETURN n;
END $$;


--
-- Name: encolar_evento(text, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.encolar_evento(p_tipo text, p_entidad uuid, p_coop uuid, p_clave text, p_datos jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE sql
    SET search_path TO 'rutaec', 'public'
    AS $$
 INSERT INTO eventos_salida(tipo,entidad_id,cooperativa_id,clave_deduplicacion,datos)
 VALUES(p_tipo,p_entidad,p_coop,p_clave,p_datos) ON CONFLICT(clave_deduplicacion) DO NOTHING;
$$;


--
-- Name: es_personal(uuid, uuid, boolean); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.es_personal(p_coop uuid, p_usuario uuid, p_solo_gerente boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'rutaec', 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM usuarios u WHERE u.id=p_usuario AND u.activo AND
 (EXISTS(SELECT 1 FROM roles_globales g WHERE g.usuario_id=u.id AND g.rol='ADMINISTRADOR') OR
 EXISTS(SELECT 1 FROM miembros_cooperativa m WHERE m.usuario_id=u.id AND m.cooperativa_id=p_coop
 AND m.activo AND (NOT p_solo_gerente OR m.rol='GERENTE'))));
$$;


--
-- Name: exigir_personal(uuid, boolean); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.exigir_personal(p_coop uuid, p_solo_gerente boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE a uuid := actor_actual();
BEGIN
 IF NOT es_personal(p_coop,a,p_solo_gerente) THEN
  RAISE EXCEPTION 'Sin permiso en esta cooperativa' USING ERRCODE='42501';
 END IF;
 RETURN a;
END $$;


--
-- Name: proteger_agenda(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.proteger_agenda() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM viajes WHERE agenda_id=OLD.id AND estado <> 'BORRADOR') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No borrar agenda histórica'; END IF;
  IF (NEW.bus_id,NEW.cooperativa_id,NEW.inicio,NEW.fin,NEW.tipo) IS DISTINCT FROM
     (OLD.bus_id,OLD.cooperativa_id,OLD.inicio,OLD.fin,OLD.tipo) THEN RAISE EXCEPTION 'Agenda histórica inmutable'; END IF;
  IF NOT NEW.activa AND EXISTS(SELECT 1 FROM viajes WHERE agenda_id=OLD.id AND estado <> 'CANCELADO') THEN
   RAISE EXCEPTION 'Cancelar viaje antes de liberar agenda';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_auditoria(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.proteger_auditoria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'La auditoría es de solo anexado'; END $$;


--
-- Name: proteger_snapshot_viaje(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.proteger_snapshot_viaje() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE v_id uuid; e text;
BEGIN
 IF TG_OP='DELETE' THEN v_id:=OLD.viaje_id; ELSE v_id:=NEW.viaje_id; END IF;
 IF TG_OP='UPDATE' AND NEW.viaje_id <> OLD.viaje_id THEN RAISE EXCEPTION 'No trasladar registros entre viajes'; END IF;
 SELECT estado INTO e FROM viajes WHERE id=v_id FOR UPDATE;
 IF e IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'El snapshot solo se edita en viaje borrador'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;


--
-- Name: reasignar_revision(uuid, uuid, text); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.reasignar_revision(p_revision uuid, p_nuevo_usuario uuid, p_motivo text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE r revisiones%ROWTYPE; a uuid:=actor_actual();
BEGIN
 SELECT * INTO STRICT r FROM revisiones WHERE id=p_revision FOR UPDATE;
 IF r.estado IN ('APROBADA','RECHAZADA') THEN RAISE EXCEPTION 'Revisión terminada'; END IF;
 IF NOT (r.asignado_a=a AND p_nuevo_usuario IS NULL) THEN PERFORM exigir_personal(r.cooperativa_id,true); END IF;
 IF nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Motivo obligatorio'; END IF;
 IF p_nuevo_usuario IS NOT NULL AND NOT EXISTS(SELECT 1 FROM miembros_cooperativa m JOIN usuarios u ON u.id=m.usuario_id
  WHERE m.cooperativa_id=r.cooperativa_id AND m.usuario_id=p_nuevo_usuario AND m.activo AND u.activo) THEN
  RAISE EXCEPTION 'Nuevo revisor no autorizado'; END IF;
 UPDATE revisiones SET asignado_a=p_nuevo_usuario,estado=CASE WHEN p_nuevo_usuario IS NULL THEN 'PENDIENTE' ELSE 'EN_REVISION' END,
  tomado_en=CASE WHEN p_nuevo_usuario IS NULL THEN NULL ELSE clock_timestamp() END WHERE id=r.id;
 INSERT INTO historial_revisiones(revision_id,actor_id,accion,motivo) VALUES(r.id,a,'REASIGNAR',p_motivo);
END $$;


--
-- Name: recibir_comprobante(uuid, uuid, text, uuid, text, date, numeric, uuid); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.recibir_comprobante(p_compra uuid, p_cuenta uuid, p_metodo text, p_archivo uuid, p_referencia text, p_fecha date, p_importe numeric, p_idempotencia uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE c compras%ROWTYPE; a uuid:=actor_actual(); pago uuid; x pagos%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM compras WHERE id=p_compra FOR UPDATE;
 IF c.comprador_id <> a AND NOT es_personal(c.cooperativa_id,a) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 SELECT * INTO x FROM pagos WHERE clave_idempotencia=p_idempotencia;
 IF FOUND THEN
  IF x.compra_id <> c.id OR x.metodo <> p_metodo OR x.cuenta_bancaria_id IS DISTINCT FROM p_cuenta THEN
   RAISE EXCEPTION 'Clave idempotente reutilizada con otros datos'; END IF;
  RETURN x.id;
 END IF;
 IF c.estado <> 'RESERVADA' THEN RAISE EXCEPTION 'Compra no admite comprobante inicial'; END IF;
 IF c.vence_en <= clock_timestamp() THEN
  UPDATE compras SET estado='VENCIDA',finalizada_en=clock_timestamp() WHERE id=c.id;
  RETURN NULL; -- El backend debe responder plazo vencido; confirmar transacción.
 END IF;
 IF p_metodo NOT IN ('DEPOSITO','TRANSFERENCIA') OR p_importe <= 0 THEN RAISE EXCEPTION 'Método/importe inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cuentas_bancarias WHERE id=p_cuenta AND cooperativa_id=c.cooperativa_id AND activa) THEN
  RAISE EXCEPTION 'Cuenta bancaria no habilitada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM archivos WHERE id=p_archivo AND propietario_id=a AND finalidad='COMPROBANTE'
  AND privado AND estado='DISPONIBLE' AND (cooperativa_id IS NULL OR cooperativa_id=c.cooperativa_id)) THEN
  RAISE EXCEPTION 'Archivo no disponible o no autorizado'; END IF;
 INSERT INTO pagos(compra_id,cooperativa_id,metodo,estado,importe,cuenta_bancaria_id,clave_idempotencia,recibido_en)
 VALUES(c.id,c.cooperativa_id,p_metodo,'EN_REVISION',c.total,p_cuenta,p_idempotencia,clock_timestamp()) RETURNING id INTO pago;
 INSERT INTO comprobantes_pago(pago_id,archivo_id,numero_referencia,fecha_operacion,importe_declarado)
 VALUES(pago,p_archivo,p_referencia,p_fecha,p_importe);
 INSERT INTO revisiones(cooperativa_id,tipo,pago_id) VALUES(c.cooperativa_id,'PAGO',pago);
 UPDATE compras SET estado='EN_REVISION' WHERE id=c.id;
 PERFORM encolar_evento('COMPROBANTE_RECIBIDO',pago,c.cooperativa_id,'comprobante:'||pago,
  jsonb_build_object('compra_id',c.id,'notificar','comprador_y_oficinistas'));
 RETURN pago;
END $$;


--
-- Name: reservar_compra(uuid, uuid, jsonb); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.reservar_compra(p_comprador uuid, p_viaje uuid, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE actor uuid:=actor_actual(); v viajes%ROWTYPE; u usuarios%ROWTYPE; t tarifas_viaje%ROWTYPE;
 p pasajeros%ROWTYPE; s asientos_viaje%ROWTYPE; val validaciones_descuento%ROWTYPE; pol politicas_descuento%ROWTYPE;
 c uuid; item jsonb; descuento numeric(12,2); vid uuid; fecha_viaje date; edad integer; ahora timestamptz;
BEGIN
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
  RAISE EXCEPTION 'Se requieren entre 1 y 50 pasajeros';
 END IF;
 PERFORM vencer_reservas();
 SELECT * INTO STRICT v FROM viajes WHERE id=p_viaje FOR SHARE;
 IF v.estado <> 'PUBLICADO' OR v.cierre_ventas <= clock_timestamp() OR
 NOT EXISTS(SELECT 1 FROM frecuencias WHERE id=v.frecuencia_id AND activa) OR
 NOT EXISTS(SELECT 1 FROM cooperativas WHERE id=v.cooperativa_id AND activa) THEN
  RAISE EXCEPTION 'Viaje no disponible para venta';
 END IF;
 IF actor <> p_comprador THEN PERFORM exigir_personal(v.cooperativa_id); END IF;
 SELECT * INTO STRICT u FROM usuarios WHERE id=p_comprador AND activo AND correo_verificado_en IS NOT NULL;
 SELECT (a.inicio AT TIME ZONE f.zona_horaria)::date INTO fecha_viaje
 FROM agenda_bus a JOIN frecuencias f ON f.id=v.frecuencia_id WHERE a.id=v.agenda_id;
 INSERT INTO compras(comprador_id,cooperativa_id,viaje_id,creado_por,canal,correo_destino)
 VALUES(p_comprador,v.cooperativa_id,v.id,actor,CASE WHEN actor=p_comprador THEN 'WEB' ELSE 'VENTANILLA' END,u.correo)
 RETURNING id INTO c;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO STRICT p FROM pasajeros WHERE id=(item->>'pasajero_id')::uuid AND comprador_id=p_comprador FOR SHARE;
  SELECT * INTO STRICT s FROM asientos_viaje WHERE viaje_id=v.id AND id=(item->>'asiento_id')::uuid AND vendible;
  SELECT * INTO STRICT t FROM tarifas_viaje WHERE id=(item->>'tarifa_id')::uuid AND viaje_id=v.id AND categoria=s.categoria;
  IF fecha_viaje < t.vigente_desde OR (t.vigente_hasta IS NOT NULL AND fecha_viaje > t.vigente_hasta)
   OR NOT EXISTS(SELECT 1 FROM paradas_viaje WHERE viaje_id=v.id AND orden=t.origen_orden AND permite_subida)
   OR NOT EXISTS(SELECT 1 FROM paradas_viaje WHERE viaje_id=v.id AND orden=t.destino_orden AND permite_bajada) THEN
   RAISE EXCEPTION 'Tarifa o tramo no habilitados';
  END IF;
  IF p.fecha_nacimiento > fecha_viaje THEN RAISE EXCEPTION 'Fecha de nacimiento inválida'; END IF;
  descuento:=0; vid:=nullif(item->>'validacion_id','')::uuid;
  IF vid IS NOT NULL THEN
   SELECT * INTO STRICT val FROM validaciones_descuento WHERE id=vid AND pasajero_id=p.id
    AND cooperativa_id=v.cooperativa_id AND estado='APROBADA' FOR SHARE;
   SELECT * INTO STRICT pol FROM politicas_descuento WHERE id=val.politica_id AND activa FOR SHARE;
   edad:=extract(year FROM age(fecha_viaje,p.fecha_nacimiento));
   IF fecha_viaje NOT BETWEEN val.valido_desde AND val.valido_hasta OR fecha_viaje < pol.vigente_desde
    OR (pol.vigente_hasta IS NOT NULL AND fecha_viaje > pol.vigente_hasta)
    OR (pol.edad_minima IS NOT NULL AND edad < pol.edad_minima)
    OR (pol.edad_maxima IS NOT NULL AND edad > pol.edad_maxima) THEN
    RAISE EXCEPTION 'Descuento no vigente o edad fuera de política';
   END IF;
   descuento:=round(t.importe*pol.porcentaje/100,2);
  END IF;
  INSERT INTO detalle_compra(compra_id,comprador_id,cooperativa_id,viaje_id,pasajero_id,asiento_id,
   origen_orden,destino_orden,categoria,tarifa_id,validacion_descuento_id,pasajero_snapshot,asiento_snapshot,precio_base,descuento)
  VALUES(c,p_comprador,v.cooperativa_id,v.id,p.id,s.id,t.origen_orden,t.destino_orden,t.categoria,t.id,vid,
   jsonb_build_object('nombres',p.nombres,'apellidos',p.apellidos,'tipo_documento',p.tipo_documento,
    'numero_documento',p.numero_documento,'fecha_nacimiento',p.fecha_nacimiento),
   jsonb_build_object('numero',s.numero,'piso',s.piso,'categoria',s.categoria),t.importe,descuento);
 END LOOP;
 ahora:=clock_timestamp();
 UPDATE compras SET total=(SELECT sum(importe) FROM detalle_compra WHERE compra_id=c),estado='RESERVADA',
  reservada_en=ahora,vence_en=ahora+interval '5 minutes' WHERE id=c;
 RETURN c;
END $$;


--
-- Name: resolver_revision_descuento(uuid, text, text); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.resolver_revision_descuento(p_revision uuid, p_decision text, p_motivo text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE r revisiones%ROWTYPE; a uuid:=actor_actual(); e text;
BEGIN
 SELECT * INTO STRICT r FROM revisiones WHERE id=p_revision FOR UPDATE;
 PERFORM exigir_personal(r.cooperativa_id);
 IF r.tipo <> 'DESCUENTO' OR r.asignado_a IS DISTINCT FROM a OR r.estado <> 'EN_REVISION' THEN
  RAISE EXCEPTION 'Revisión no disponible para este usuario'; END IF;
 e:=CASE p_decision WHEN 'APROBAR' THEN 'APROBADA' WHEN 'RECHAZAR' THEN 'RECHAZADA' WHEN 'CORREGIR' THEN 'CORRECCION' END;
 IF e IS NULL OR nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Decisión y motivo obligatorios'; END IF;
 UPDATE validaciones_descuento SET estado=e,revisado_por=a,revisado_en=clock_timestamp(),motivo=p_motivo WHERE id=r.validacion_id;
 UPDATE revisiones SET estado=e,motivo=p_motivo,resuelto_en=CASE WHEN e='CORRECCION' THEN NULL ELSE clock_timestamp() END WHERE id=r.id;
 INSERT INTO historial_revisiones(revision_id,actor_id,accion,motivo) VALUES(r.id,a,p_decision,p_motivo);
 PERFORM encolar_evento('DESCUENTO_'||e,r.validacion_id,r.cooperativa_id,
  'descuento:'||r.id||':'||e||':'||(SELECT count(*) FROM historial_revisiones WHERE revision_id=r.id));
END $$;


--
-- Name: resolver_revision_pago(uuid, text, text, numeric, text); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.resolver_revision_pago(p_revision uuid, p_decision text, p_motivo text, p_importe_verificado numeric DEFAULT NULL::numeric, p_referencia text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE r revisiones%ROWTYPE; p pagos%ROWTYPE; c compras%ROWTYPE; a uuid:=actor_actual(); resultado text; cid uuid;
BEGIN
 SELECT pg.compra_id INTO STRICT cid FROM revisiones rv JOIN pagos pg ON pg.id=rv.pago_id WHERE rv.id=p_revision;
 SELECT * INTO STRICT c FROM compras WHERE id=cid FOR UPDATE;
 SELECT pg.* INTO STRICT p FROM pagos pg JOIN revisiones rv ON rv.pago_id=pg.id WHERE rv.id=p_revision FOR UPDATE OF pg;
 SELECT * INTO STRICT r FROM revisiones WHERE id=p_revision FOR UPDATE;
 PERFORM exigir_personal(r.cooperativa_id);
 IF r.asignado_a IS DISTINCT FROM a OR r.estado <> 'EN_REVISION' OR p.metodo='TARJETA' THEN
  RAISE EXCEPTION 'Revisión no asignada, finalizada o pago de tarjeta'; END IF;
 IF p.estado NOT IN ('EN_REVISION','CORRECCION') THEN RAISE EXCEPTION 'Pago no admite esta decisión'; END IF;
 IF p_decision NOT IN ('APROBAR','RECHAZAR','CORREGIR') OR nullif(btrim(p_motivo),'') IS NULL THEN
  RAISE EXCEPTION 'Decisión y motivo obligatorios'; END IF;
 IF p_decision='APROBAR' THEN
  IF p_importe_verificado IS NULL THEN RAISE EXCEPTION 'Verificar importe en la cuenta bancaria'; END IF;
  resultado:=confirmar_pago(p.id,p_importe_verificado,'USD',p_referencia,NULL);
  UPDATE revisiones SET estado='APROBADA',resuelto_en=clock_timestamp(),motivo=p_motivo WHERE id=r.id;
 ELSIF p_decision='CORREGIR' THEN
  UPDATE pagos SET estado='CORRECCION',motivo=p_motivo WHERE id=p.id;
  UPDATE revisiones SET estado='CORRECCION',motivo=p_motivo WHERE id=r.id;
  resultado:='CORRECCION';
 ELSE
  -- Rechazo sin dinero recibido. Si existe dinero, usar incidencia y conciliación.
  IF p.importe_recibido IS NOT NULL AND p.importe_recibido > 0 THEN RAISE EXCEPTION 'Dinero recibido: resolver por incidencia'; END IF;
  UPDATE pagos SET estado='RECHAZADO',motivo=p_motivo WHERE id=p.id;
  UPDATE revisiones SET estado='RECHAZADA',motivo=p_motivo,resuelto_en=clock_timestamp() WHERE id=r.id;
  UPDATE compras SET estado='RECHAZADA',motivo=p_motivo,finalizada_en=clock_timestamp() WHERE id=c.id;
  resultado:='RECHAZADA';
 END IF;
 INSERT INTO historial_revisiones(revision_id,actor_id,accion,motivo) VALUES(r.id,a,p_decision,p_motivo);
 PERFORM encolar_evento('REVISION_PAGO_'||p_decision,r.id,r.cooperativa_id,
  'revision:'||r.id||':'||p_decision||':'||(SELECT count(*) FROM historial_revisiones WHERE revision_id=r.id),
  jsonb_build_object('compra_id',c.id,'resultado',resultado));
 RETURN resultado;
END $$;


--
-- Name: sincronizar_compra(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.sincronizar_compra() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
BEGIN
 IF NEW.estado IS DISTINCT FROM OLD.estado THEN
  IF NEW.estado IN ('VENCIDA','RECHAZADA','CANCELADA','INCIDENCIA') THEN
   UPDATE detalle_compra SET estado='LIBERADO' WHERE compra_id=NEW.id AND estado <> 'LIBERADO';
  ELSIF NEW.estado='CONFIRMADA' THEN
   UPDATE detalle_compra SET estado='CONFIRMADO' WHERE compra_id=NEW.id AND estado <> 'CONFIRMADO';
  END IF;
  PERFORM encolar_evento('COMPRA_'||NEW.estado,NEW.id,NEW.cooperativa_id,
   'compra:'||NEW.id||':'||NEW.estado,jsonb_build_object('compra_id',NEW.id));
 END IF;
 RETURN NEW;
END $$;


--
-- Name: solicitar_descuento(uuid, uuid, uuid, uuid, date, date); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.solicitar_descuento(p_pasajero uuid, p_coop uuid, p_politica uuid, p_documento uuid, p_desde date, p_hasta date) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE a uuid:=actor_actual(); comprador uuid; vid uuid;
BEGIN
 SELECT comprador_id INTO STRICT comprador FROM pasajeros WHERE id=p_pasajero;
 IF a <> comprador AND NOT es_personal(p_coop,a) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 INSERT INTO validaciones_descuento(pasajero_id,cooperativa_id,politica_id,documento_id,valido_desde,valido_hasta)
 VALUES(p_pasajero,p_coop,p_politica,p_documento,p_desde,p_hasta) RETURNING id INTO vid;
 INSERT INTO revisiones(cooperativa_id,tipo,validacion_id) VALUES(p_coop,'DESCUENTO',vid);
 PERFORM encolar_evento('DOCUMENTO_RECIBIDO',vid,p_coop,'documento:'||vid,jsonb_build_object('comprador_id',comprador));
 RETURN vid;
END $$;


--
-- Name: tomar_revision(uuid); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.tomar_revision(p_revision uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE r revisiones%ROWTYPE; a uuid:=actor_actual();
BEGIN
 SELECT * INTO STRICT r FROM revisiones WHERE id=p_revision FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM miembros_cooperativa WHERE cooperativa_id=r.cooperativa_id AND usuario_id=a AND activo) THEN
  RAISE EXCEPTION 'La revisión requiere miembro activo de la cooperativa' USING ERRCODE='42501'; END IF;
 IF r.estado IN ('APROBADA','RECHAZADA') THEN RAISE EXCEPTION 'Revisión terminada'; END IF;
 IF r.asignado_a IS NOT NULL AND r.asignado_a <> a THEN RAISE EXCEPTION 'Otro oficinista tiene esta revisión'; END IF;
 UPDATE revisiones SET asignado_a=a,estado='EN_REVISION',tomado_en=coalesce(tomado_en,clock_timestamp()) WHERE id=r.id;
 INSERT INTO historial_revisiones(revision_id,actor_id,accion) VALUES(r.id,a,'TOMAR');
END $$;


--
-- Name: validar_documento(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.validar_documento() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pasajeros p JOIN archivos a ON a.id=NEW.archivo_id
  WHERE p.id=NEW.pasajero_id AND a.propietario_id=p.comprador_id
  AND a.finalidad='IDENTIDAD' AND a.privado AND a.estado='DISPONIBLE') THEN
  RAISE EXCEPTION 'Documento no disponible o no pertenece al comprador';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_publicacion(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.validar_publicacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE a agenda_bus%ROWTYPE; b buses%ROWTYPE; f frecuencias%ROWTYPE;
 r resoluciones%ROWTYPE; h hojas_ruta%ROWTYPE; dia date; n integer;
BEGIN
 IF TG_OP='UPDATE' AND OLD.estado <> 'BORRADOR' THEN
  IF NEW.estado='BORRADOR' OR (NEW.bus_id,NEW.agenda_id,NEW.ruta_id,NEW.frecuencia_id,NEW.hoja_ruta_id,NEW.cooperativa_id)
    IS DISTINCT FROM (OLD.bus_id,OLD.agenda_id,OLD.ruta_id,OLD.frecuencia_id,OLD.hoja_ruta_id,OLD.cooperativa_id) THEN
   RAISE EXCEPTION 'No cambiar asignaciones de un viaje publicado; cancelar y crear otro';
  END IF;
 END IF;
 IF NEW.estado <> 'PUBLICADO' THEN RETURN NEW; END IF;
 SELECT * INTO STRICT a FROM agenda_bus WHERE id=NEW.agenda_id FOR SHARE;
 SELECT * INTO STRICT b FROM buses WHERE id=NEW.bus_id FOR SHARE;
 SELECT * INTO STRICT f FROM frecuencias WHERE id=NEW.frecuencia_id FOR SHARE;
 SELECT * INTO STRICT r FROM resoluciones WHERE id=f.resolucion_id FOR SHARE;
 SELECT * INTO STRICT h FROM hojas_ruta WHERE id=NEW.hoja_ruta_id FOR SHARE;
 dia:=(a.inicio AT TIME ZONE f.zona_horaria)::date;
 IF a.tipo <> 'VIAJE' OR NOT a.activa OR b.estado <> 'ACTIVO' OR NOT f.activa OR h.estado <> 'PUBLICADA'
 OR h.grupo_id <> b.grupo_id OR h.fecha <> dia OR NEW.cierre_ventas > a.inicio THEN
  RAISE EXCEPTION 'Agenda, bus, hoja o cierre de ventas inválidos';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM cooperativas WHERE id=NEW.cooperativa_id AND activa)
 OR NOT EXISTS(SELECT 1 FROM rutas WHERE id=NEW.ruta_id AND activa) THEN RAISE EXCEPTION 'Cooperativa/ruta inactiva'; END IF;
 IF (a.inicio AT TIME ZONE f.zona_horaria)::time <> f.hora_salida
 OR NOT EXISTS(SELECT 1 FROM dias_frecuencia WHERE frecuencia_id=f.id AND dia_iso=extract(isodow FROM dia))
 OR dia < r.vigente_desde OR (r.vigente_hasta IS NOT NULL AND dia > r.vigente_hasta) THEN
  RAISE EXCEPTION 'Fecha/hora no coincide con autorización y días de frecuencia';
 END IF;
 SELECT count(*) INTO n FROM paradas_viaje WHERE viaje_id=NEW.id;
 IF n < 2 OR (SELECT min(orden)<>1 OR max(orden)<>count(*) FROM paradas_viaje WHERE viaje_id=NEW.id)
 OR EXISTS(SELECT 1 FROM paradas_viaje x JOIN paradas_viaje y ON y.viaje_id=x.viaje_id AND y.orden=x.orden+1
   WHERE x.viaje_id=NEW.id AND y.llegada < x.salida)
 OR (SELECT salida FROM paradas_viaje WHERE viaje_id=NEW.id AND orden=1) <> a.inicio
 OR (SELECT llegada FROM paradas_viaje WHERE viaje_id=NEW.id AND orden=n) <> a.fin THEN
  RAISE EXCEPTION 'Paradas desordenadas, incompletas o fuera de agenda';
 END IF;
 IF EXISTS(SELECT orden,terminal_id FROM paradas_viaje WHERE viaje_id=NEW.id
 EXCEPT SELECT orden,terminal_id FROM paradas_ruta WHERE ruta_id=NEW.ruta_id)
 OR EXISTS(SELECT orden,terminal_id FROM paradas_ruta WHERE ruta_id=NEW.ruta_id
 EXCEPT SELECT orden,terminal_id FROM paradas_viaje WHERE viaje_id=NEW.id) THEN
  RAISE EXCEPTION 'Paradas de viaje no corresponden a la ruta autorizada';
 END IF;
 IF (SELECT count(*) FROM asientos_viaje WHERE viaje_id=NEW.id) <> b.capacidad
 OR EXISTS(SELECT 1 FROM asientos_viaje WHERE viaje_id=NEW.id AND piso > b.pisos)
 OR NOT EXISTS(SELECT 1 FROM tarifas_viaje WHERE viaje_id=NEW.id) THEN
  RAISE EXCEPTION 'Capacidad, pisos o tarifas incompletos';
 END IF;
 NEW.publicado_en:=coalesce(NEW.publicado_en,clock_timestamp());
 RETURN NEW;
END $$;


--
-- Name: vencer_reservas(); Type: FUNCTION; Schema: rutaec; Owner: -
--

CREATE FUNCTION rutaec.vencer_reservas() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'rutaec', 'public'
    AS $$
DECLARE c record; n integer:=0;
BEGIN
 FOR c IN SELECT id FROM compras WHERE estado='RESERVADA' AND vence_en <= clock_timestamp()
  ORDER BY id FOR UPDATE SKIP LOCKED LOOP
  UPDATE compras SET estado='VENCIDA',finalizada_en=clock_timestamp(),motivo='Plazo de cinco minutos vencido'
   WHERE id=c.id;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agenda_bus; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.agenda_bus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    bus_id uuid NOT NULL,
    tipo text NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fin timestamp with time zone NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    motivo text,
    periodo tstzrange GENERATED ALWAYS AS (tstzrange(inicio, fin, '[)'::text)) STORED,
    CONSTRAINT agenda_bus_check CHECK ((fin > inicio)),
    CONSTRAINT agenda_bus_tipo_check CHECK ((tipo = ANY (ARRAY['VIAJE'::text, 'DESCANSO'::text, 'MANTENIMIENTO'::text])))
);


--
-- Name: archivos; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.archivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    propietario_id uuid NOT NULL,
    cooperativa_id uuid,
    objeto_clave text NOT NULL,
    finalidad text NOT NULL,
    nombre_original text NOT NULL,
    mime_type text NOT NULL,
    tamano_bytes bigint NOT NULL,
    sha256 character(64) NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    privado boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    eliminado_en timestamp with time zone,
    CONSTRAINT archivos_check CHECK (((finalidad <> ALL (ARRAY['IDENTIDAD'::text, 'COMPROBANTE'::text, 'BOLETO'::text])) OR privado)),
    CONSTRAINT archivos_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'DISPONIBLE'::text, 'RECHAZADO'::text, 'ELIMINADO'::text]))),
    CONSTRAINT archivos_finalidad_check CHECK ((finalidad = ANY (ARRAY['IDENTIDAD'::text, 'COMPROBANTE'::text, 'RESOLUCION'::text, 'LOGO'::text, 'BUS'::text, 'BOLETO'::text, 'OTRO'::text]))),
    CONSTRAINT archivos_sha256_check CHECK ((sha256 ~ '^[0-9a-fA-F]{64}$'::text)),
    CONSTRAINT archivos_tamano_bytes_check CHECK ((tamano_bytes > 0))
);


--
-- Name: asientos_bus; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.asientos_bus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bus_id uuid NOT NULL,
    numero text NOT NULL,
    piso smallint NOT NULL,
    fila smallint NOT NULL,
    columna smallint NOT NULL,
    categoria text NOT NULL,
    preferencial boolean DEFAULT false NOT NULL,
    accesible boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT asientos_bus_categoria_check CHECK ((categoria = ANY (ARRAY['NORMAL'::text, 'VIP'::text]))),
    CONSTRAINT asientos_bus_columna_check CHECK ((columna > 0)),
    CONSTRAINT asientos_bus_fila_check CHECK ((fila > 0)),
    CONSTRAINT asientos_bus_piso_check CHECK (((piso >= 1) AND (piso <= 2)))
);


--
-- Name: asientos_viaje; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.asientos_viaje (
    viaje_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero text NOT NULL,
    piso smallint NOT NULL,
    fila smallint NOT NULL,
    columna smallint NOT NULL,
    categoria text NOT NULL,
    accesible boolean DEFAULT false NOT NULL,
    preferencial boolean DEFAULT false NOT NULL,
    vendible boolean DEFAULT true NOT NULL,
    CONSTRAINT asientos_viaje_categoria_check CHECK ((categoria = ANY (ARRAY['NORMAL'::text, 'VIP'::text]))),
    CONSTRAINT asientos_viaje_columna_check CHECK ((columna > 0)),
    CONSTRAINT asientos_viaje_fila_check CHECK ((fila > 0)),
    CONSTRAINT asientos_viaje_piso_check CHECK (((piso >= 1) AND (piso <= 2)))
);


--
-- Name: auditoria; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.auditoria (
    id bigint NOT NULL,
    actor_id uuid,
    cooperativa_id uuid,
    entidad text NOT NULL,
    entidad_id uuid,
    accion text NOT NULL,
    estado_anterior text,
    estado_nuevo text,
    correlacion_id uuid,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: rutaec; Owner: -
--

ALTER TABLE rutaec.auditoria ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rutaec.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: boletos; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.boletos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    detalle_id uuid NOT NULL,
    compra_id uuid NOT NULL,
    codigo uuid DEFAULT gen_random_uuid() NOT NULL,
    qr_token uuid DEFAULT gen_random_uuid() NOT NULL,
    estado text DEFAULT 'EMITIDO'::text NOT NULL,
    datos_emision jsonb NOT NULL,
    pdf_archivo_id uuid,
    emitido_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    anulado_en timestamp with time zone,
    motivo_anulacion text,
    CONSTRAINT boletos_check CHECK (((estado <> 'ANULADO'::text) OR ((anulado_en IS NOT NULL) AND (motivo_anulacion IS NOT NULL)))),
    CONSTRAINT boletos_estado_check CHECK ((estado = ANY (ARRAY['EMITIDO'::text, 'ANULADO'::text])))
);


--
-- Name: bus_comodidades; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.bus_comodidades (
    bus_id uuid NOT NULL,
    comodidad text NOT NULL
);


--
-- Name: buses; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.buses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    grupo_id uuid NOT NULL,
    placa text NOT NULL,
    numero_unidad text NOT NULL,
    color text NOT NULL,
    marca_chasis text NOT NULL,
    marca_carroceria text NOT NULL,
    anio smallint,
    pisos smallint NOT NULL,
    capacidad smallint NOT NULL,
    imagen_url text,
    estado text DEFAULT 'ACTIVO'::text NOT NULL,
    CONSTRAINT buses_anio_check CHECK (((anio >= 1900) AND (anio <= 2200))),
    CONSTRAINT buses_capacidad_check CHECK ((capacidad > 0)),
    CONSTRAINT buses_estado_check CHECK ((estado = ANY (ARRAY['ACTIVO'::text, 'INACTIVO'::text, 'MANTENIMIENTO'::text]))),
    CONSTRAINT buses_pisos_check CHECK (((pisos >= 1) AND (pisos <= 2)))
);


--
-- Name: ciudades; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.ciudades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pais character(2) DEFAULT 'EC'::bpchar NOT NULL,
    provincia text NOT NULL,
    nombre text NOT NULL
);


--
-- Name: comodidades; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.comodidades (
    codigo text NOT NULL,
    nombre text NOT NULL
);


--
-- Name: compras; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo uuid DEFAULT gen_random_uuid() NOT NULL,
    comprador_id uuid NOT NULL,
    cooperativa_id uuid NOT NULL,
    viaje_id uuid NOT NULL,
    creado_por uuid NOT NULL,
    canal text NOT NULL,
    estado text DEFAULT 'BORRADOR'::text NOT NULL,
    correo_destino text NOT NULL,
    moneda character(3) DEFAULT 'USD'::bpchar NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    creada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    reservada_en timestamp with time zone,
    vence_en timestamp with time zone,
    confirmada_en timestamp with time zone,
    finalizada_en timestamp with time zone,
    motivo text,
    CONSTRAINT compras_canal_check CHECK ((canal = ANY (ARRAY['WEB'::text, 'VENTANILLA'::text]))),
    CONSTRAINT compras_check CHECK ((((reservada_en IS NULL) AND (vence_en IS NULL)) OR (vence_en = (reservada_en + '00:05:00'::interval)))),
    CONSTRAINT compras_estado_check CHECK ((estado = ANY (ARRAY['BORRADOR'::text, 'RESERVADA'::text, 'EN_REVISION'::text, 'CONFIRMADA'::text, 'VENCIDA'::text, 'RECHAZADA'::text, 'CANCELADA'::text, 'INCIDENCIA'::text]))),
    CONSTRAINT compras_moneda_check CHECK ((moneda = 'USD'::bpchar)),
    CONSTRAINT compras_total_check CHECK ((total >= (0)::numeric))
);


--
-- Name: comprobantes_pago; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.comprobantes_pago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pago_id uuid NOT NULL,
    archivo_id uuid NOT NULL,
    numero_referencia text NOT NULL,
    fecha_operacion date NOT NULL,
    importe_declarado numeric(12,2) NOT NULL,
    recibido_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT comprobantes_pago_importe_declarado_check CHECK ((importe_declarado > (0)::numeric))
);


--
-- Name: cooperativas; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.cooperativas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ruc character(13) NOT NULL,
    razon_social text NOT NULL,
    nombre_comercial text NOT NULL,
    color_primario character(7) DEFAULT '#16324F'::bpchar NOT NULL,
    color_secundario character(7) DEFAULT '#FFFFFF'::bpchar NOT NULL,
    correo text NOT NULL,
    telefono text NOT NULL,
    direccion text NOT NULL,
    sitio_web text,
    redes_sociales jsonb DEFAULT '{}'::jsonb NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    logo_archivo_id uuid,
    CONSTRAINT cooperativas_color_primario_check CHECK ((color_primario ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT cooperativas_color_secundario_check CHECK ((color_secundario ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT cooperativas_ruc_check CHECK ((ruc ~ '^[0-9]{13}$'::text))
);


--
-- Name: cuentas_bancarias; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.cuentas_bancarias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    banco text NOT NULL,
    tipo text NOT NULL,
    numero text NOT NULL,
    titular text NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    CONSTRAINT cuentas_bancarias_tipo_check CHECK ((tipo = ANY (ARRAY['AHORROS'::text, 'CORRIENTE'::text])))
);


--
-- Name: detalle_compra; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.detalle_compra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compra_id uuid NOT NULL,
    comprador_id uuid NOT NULL,
    cooperativa_id uuid NOT NULL,
    viaje_id uuid NOT NULL,
    pasajero_id uuid NOT NULL,
    asiento_id uuid NOT NULL,
    origen_orden integer NOT NULL,
    destino_orden integer NOT NULL,
    categoria text NOT NULL,
    tarifa_id uuid NOT NULL,
    validacion_descuento_id uuid,
    pasajero_snapshot jsonb NOT NULL,
    asiento_snapshot jsonb NOT NULL,
    precio_base numeric(12,2) NOT NULL,
    descuento numeric(12,2) DEFAULT 0 NOT NULL,
    importe numeric(12,2) GENERATED ALWAYS AS ((precio_base - descuento)) STORED,
    tramo int4range GENERATED ALWAYS AS (int4range(origen_orden, destino_orden, '[)'::text)) STORED,
    estado text DEFAULT 'RETENIDO'::text NOT NULL,
    CONSTRAINT detalle_compra_check CHECK ((destino_orden > origen_orden)),
    CONSTRAINT detalle_compra_check1 CHECK (((descuento >= (0)::numeric) AND (descuento < precio_base))),
    CONSTRAINT detalle_compra_check2 CHECK (((descuento = (0)::numeric) OR (validacion_descuento_id IS NOT NULL))),
    CONSTRAINT detalle_compra_estado_check CHECK ((estado = ANY (ARRAY['RETENIDO'::text, 'CONFIRMADO'::text, 'LIBERADO'::text]))),
    CONSTRAINT detalle_compra_precio_base_check CHECK ((precio_base > (0)::numeric))
);


--
-- Name: dias_frecuencia; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.dias_frecuencia (
    frecuencia_id uuid NOT NULL,
    dia_iso smallint NOT NULL,
    CONSTRAINT dias_frecuencia_dia_iso_check CHECK (((dia_iso >= 1) AND (dia_iso <= 7)))
);


--
-- Name: documentos_pasajero; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.documentos_pasajero (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pasajero_id uuid NOT NULL,
    archivo_id uuid NOT NULL,
    tipo text NOT NULL,
    vence_en date,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: envios_correo; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.envios_correo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evento_id uuid NOT NULL,
    destinatario text NOT NULL,
    plantilla text NOT NULL,
    variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    compra_id uuid,
    adjunto_archivo_id uuid,
    clave_deduplicacion text NOT NULL,
    proveedor_id text,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    proximo_intento_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    bloqueado_hasta timestamp with time zone,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    enviado_en timestamp with time zone,
    ultimo_error text,
    CONSTRAINT envios_correo_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'ENVIANDO'::text, 'ENVIADO'::text, 'ERROR'::text]))),
    CONSTRAINT envios_correo_intentos_check CHECK ((intentos >= 0))
);


--
-- Name: eventos_proveedor; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.eventos_proveedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pago_id uuid NOT NULL,
    proveedor text NOT NULL,
    evento_externo_id text NOT NULL,
    tipo text NOT NULL,
    firma_verificada boolean DEFAULT false NOT NULL,
    resumen jsonb DEFAULT '{}'::jsonb NOT NULL,
    recibido_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    procesado_en timestamp with time zone
);


--
-- Name: eventos_salida; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.eventos_salida (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    entidad_id uuid NOT NULL,
    cooperativa_id uuid,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    clave_deduplicacion text NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    disponible_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    bloqueado_hasta timestamp with time zone,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    procesado_en timestamp with time zone,
    ultimo_error text,
    CONSTRAINT eventos_salida_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'PROCESANDO'::text, 'COMPLETADO'::text, 'ERROR'::text]))),
    CONSTRAINT eventos_salida_intentos_check CHECK ((intentos >= 0))
);


--
-- Name: frecuencias; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.frecuencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    codigo text NOT NULL,
    ruta_id uuid NOT NULL,
    resolucion_id uuid NOT NULL,
    hora_salida time without time zone NOT NULL,
    zona_horaria text DEFAULT 'America/Guayaquil'::text NOT NULL,
    activa boolean DEFAULT true NOT NULL
);


--
-- Name: grupos_buses; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.grupos_buses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    nombre text NOT NULL,
    tipo text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT grupos_buses_tipo_check CHECK ((tipo = ANY (ARRAY['LARGA_DISTANCIA'::text, 'CANTONAL'::text, 'LOCAL'::text])))
);


--
-- Name: historial_revisiones; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.historial_revisiones (
    id bigint NOT NULL,
    revision_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    accion text NOT NULL,
    motivo text,
    fecha timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: historial_revisiones_id_seq; Type: SEQUENCE; Schema: rutaec; Owner: -
--

ALTER TABLE rutaec.historial_revisiones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rutaec.historial_revisiones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hojas_ruta; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.hojas_ruta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    grupo_id uuid NOT NULL,
    fecha date NOT NULL,
    estado text DEFAULT 'BORRADOR'::text NOT NULL,
    creado_por uuid NOT NULL,
    CONSTRAINT hojas_ruta_estado_check CHECK ((estado = ANY (ARRAY['BORRADOR'::text, 'PUBLICADA'::text, 'CERRADA'::text])))
);


--
-- Name: incidencias; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.incidencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compra_id uuid NOT NULL,
    cooperativa_id uuid NOT NULL,
    pago_id uuid,
    tipo text NOT NULL,
    descripcion text NOT NULL,
    estado text DEFAULT 'ABIERTA'::text NOT NULL,
    creado_por uuid,
    asignado_a uuid,
    resolucion text,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    resuelto_en timestamp with time zone,
    CONSTRAINT incidencias_check CHECK (((estado <> 'RESUELTA'::text) OR ((resuelto_en IS NOT NULL) AND (resolucion IS NOT NULL)))),
    CONSTRAINT incidencias_estado_check CHECK ((estado = ANY (ARRAY['ABIERTA'::text, 'EN_ATENCION'::text, 'RESUELTA'::text]))),
    CONSTRAINT incidencias_tipo_check CHECK ((tipo = ANY (ARRAY['PAGO_TARDIO'::text, 'IMPORTE_INCORRECTO'::text, 'PAGO_DUPLICADO'::text, 'CANCELACION'::text, 'DEVOLUCION'::text, 'OTRO'::text])))
);


--
-- Name: miembros_cooperativa; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.miembros_cooperativa (
    cooperativa_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    rol text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    asignado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT miembros_cooperativa_rol_check CHECK ((rol = ANY (ARRAY['GERENTE'::text, 'OFICINISTA'::text])))
);


--
-- Name: notificaciones; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.notificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    cooperativa_id uuid,
    evento_id uuid,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    destino_interno text,
    clave_deduplicacion text NOT NULL,
    creada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    leida_en timestamp with time zone
);


--
-- Name: pagos; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.pagos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compra_id uuid NOT NULL,
    cooperativa_id uuid NOT NULL,
    metodo text NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    importe numeric(12,2) NOT NULL,
    moneda character(3) DEFAULT 'USD'::bpchar NOT NULL,
    cuenta_bancaria_id uuid,
    proveedor text,
    referencia_proveedor text,
    clave_idempotencia uuid NOT NULL,
    sandbox boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    recibido_en timestamp with time zone,
    aprobado_en timestamp with time zone,
    confirmado_por uuid,
    motivo text,
    importe_recibido numeric(12,2),
    moneda_recibida character(3),
    CONSTRAINT pagos_check CHECK ((((metodo = 'TARJETA'::text) AND (proveedor IS NOT NULL) AND (cuenta_bancaria_id IS NULL)) OR ((metodo = ANY (ARRAY['DEPOSITO'::text, 'TRANSFERENCIA'::text])) AND (cuenta_bancaria_id IS NOT NULL)))),
    CONSTRAINT pagos_check1 CHECK (((estado <> 'APROBADO'::text) OR (aprobado_en IS NOT NULL))),
    CONSTRAINT pagos_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'EN_REVISION'::text, 'CORRECCION'::text, 'APROBADO'::text, 'RECHAZADO'::text, 'FALLIDO'::text, 'RECIBIDO_INCIDENCIA'::text]))),
    CONSTRAINT pagos_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT pagos_importe_recibido_check CHECK ((importe_recibido >= (0)::numeric)),
    CONSTRAINT pagos_metodo_check CHECK ((metodo = ANY (ARRAY['TRANSFERENCIA'::text, 'DEPOSITO'::text, 'TARJETA'::text]))),
    CONSTRAINT pagos_moneda_check CHECK ((moneda = 'USD'::bpchar))
);


--
-- Name: paradas_ruta; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.paradas_ruta (
    ruta_id uuid NOT NULL,
    orden integer NOT NULL,
    terminal_id uuid NOT NULL,
    minutos_desde_origen integer NOT NULL,
    permite_subida boolean DEFAULT true NOT NULL,
    permite_bajada boolean DEFAULT true NOT NULL,
    CONSTRAINT paradas_ruta_minutos_desde_origen_check CHECK ((minutos_desde_origen >= 0)),
    CONSTRAINT paradas_ruta_orden_check CHECK ((orden > 0))
);


--
-- Name: paradas_viaje; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.paradas_viaje (
    viaje_id uuid NOT NULL,
    orden integer NOT NULL,
    terminal_id uuid NOT NULL,
    nombre_snapshot text NOT NULL,
    llegada timestamp with time zone NOT NULL,
    salida timestamp with time zone NOT NULL,
    permite_subida boolean DEFAULT true NOT NULL,
    permite_bajada boolean DEFAULT true NOT NULL,
    CONSTRAINT paradas_viaje_check CHECK ((salida >= llegada)),
    CONSTRAINT paradas_viaje_orden_check CHECK ((orden > 0))
);


--
-- Name: pasajeros; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.pasajeros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comprador_id uuid NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    fecha_nacimiento date NOT NULL,
    tipo_documento text NOT NULL,
    pais_documento character(2) DEFAULT 'EC'::bpchar NOT NULL,
    numero_documento text NOT NULL,
    CONSTRAINT pasajeros_tipo_documento_check CHECK ((tipo_documento = ANY (ARRAY['CEDULA'::text, 'PASAPORTE'::text, 'OTRO'::text])))
);


--
-- Name: politicas_descuento; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.politicas_descuento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    version integer NOT NULL,
    descripcion text NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    edad_minima smallint,
    edad_maxima smallint,
    documento_requerido text NOT NULL,
    fuente_normativa text NOT NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date,
    activa boolean DEFAULT true NOT NULL,
    CONSTRAINT politicas_descuento_check CHECK (((edad_maxima IS NULL) OR (edad_minima IS NULL) OR (edad_maxima >= edad_minima))),
    CONSTRAINT politicas_descuento_check1 CHECK (((vigente_hasta IS NULL) OR (vigente_hasta >= vigente_desde))),
    CONSTRAINT politicas_descuento_edad_maxima_check CHECK ((edad_maxima >= 0)),
    CONSTRAINT politicas_descuento_edad_minima_check CHECK ((edad_minima >= 0)),
    CONSTRAINT politicas_descuento_porcentaje_check CHECK (((porcentaje > (0)::numeric) AND (porcentaje < (100)::numeric))),
    CONSTRAINT politicas_descuento_version_check CHECK ((version > 0))
);


--
-- Name: reembolsos; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.reembolsos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incidencia_id uuid NOT NULL,
    pago_id uuid NOT NULL,
    importe numeric(12,2) NOT NULL,
    estado text DEFAULT 'SOLICITADO'::text NOT NULL,
    motivo text NOT NULL,
    referencia text,
    gestionado_por uuid,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    realizado_en timestamp with time zone,
    CONSTRAINT reembolsos_check CHECK (((estado <> 'REALIZADO'::text) OR ((referencia IS NOT NULL) AND (realizado_en IS NOT NULL)))),
    CONSTRAINT reembolsos_estado_check CHECK ((estado = ANY (ARRAY['SOLICITADO'::text, 'APROBADO'::text, 'REALIZADO'::text, 'RECHAZADO'::text]))),
    CONSTRAINT reembolsos_importe_check CHECK ((importe > (0)::numeric))
);


--
-- Name: resoluciones; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.resoluciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    numero text NOT NULL,
    autoridad text NOT NULL,
    fecha_emision date NOT NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date,
    archivo_id uuid,
    CONSTRAINT resoluciones_check CHECK (((vigente_hasta IS NULL) OR (vigente_hasta >= vigente_desde)))
);


--
-- Name: revisiones; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.revisiones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    tipo text NOT NULL,
    pago_id uuid,
    validacion_id uuid,
    asignado_a uuid,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    tomado_en timestamp with time zone,
    resuelto_en timestamp with time zone,
    alertado_en timestamp with time zone,
    motivo text,
    CONSTRAINT revisiones_check CHECK ((((tipo = 'PAGO'::text) AND (pago_id IS NOT NULL) AND (validacion_id IS NULL)) OR ((tipo = 'DESCUENTO'::text) AND (validacion_id IS NOT NULL) AND (pago_id IS NULL)))),
    CONSTRAINT revisiones_check1 CHECK (((estado <> 'EN_REVISION'::text) OR (asignado_a IS NOT NULL))),
    CONSTRAINT revisiones_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'EN_REVISION'::text, 'CORRECCION'::text, 'APROBADA'::text, 'RECHAZADA'::text]))),
    CONSTRAINT revisiones_tipo_check CHECK ((tipo = ANY (ARRAY['PAGO'::text, 'DESCUENTO'::text])))
);


--
-- Name: roles; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.roles (
    codigo text NOT NULL,
    nombre text NOT NULL,
    CONSTRAINT roles_codigo_check CHECK ((codigo = ANY (ARRAY['ADMINISTRADOR'::text, 'GERENTE'::text, 'OFICINISTA'::text, 'CLIENTE'::text])))
);


--
-- Name: roles_globales; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.roles_globales (
    usuario_id uuid NOT NULL,
    rol text NOT NULL,
    CONSTRAINT roles_globales_rol_check CHECK ((rol = ANY (ARRAY['ADMINISTRADOR'::text, 'CLIENTE'::text])))
);


--
-- Name: rutas; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.rutas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    nombre text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    CONSTRAINT rutas_version_check CHECK ((version > 0))
);


--
-- Name: servicios_contratados; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.servicios_contratados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    inicio date NOT NULL,
    fin date,
    importe numeric(12,2) DEFAULT 0 NOT NULL,
    estado text NOT NULL,
    CONSTRAINT servicios_contratados_check CHECK (((fin IS NULL) OR (fin >= inicio))),
    CONSTRAINT servicios_contratados_estado_check CHECK ((estado = ANY (ARRAY['ACTIVO'::text, 'SUSPENDIDO'::text, 'FINALIZADO'::text]))),
    CONSTRAINT servicios_contratados_importe_check CHECK ((importe >= (0)::numeric))
);


--
-- Name: tarifas_viaje; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.tarifas_viaje (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    viaje_id uuid NOT NULL,
    origen_orden integer NOT NULL,
    destino_orden integer NOT NULL,
    categoria text NOT NULL,
    importe numeric(12,2) NOT NULL,
    moneda character(3) DEFAULT 'USD'::bpchar NOT NULL,
    fuente_normativa text NOT NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date,
    CONSTRAINT tarifas_viaje_categoria_check CHECK ((categoria = ANY (ARRAY['NORMAL'::text, 'VIP'::text]))),
    CONSTRAINT tarifas_viaje_check CHECK ((destino_orden > origen_orden)),
    CONSTRAINT tarifas_viaje_check1 CHECK (((vigente_hasta IS NULL) OR (vigente_hasta >= vigente_desde))),
    CONSTRAINT tarifas_viaje_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT tarifas_viaje_moneda_check CHECK ((moneda = 'USD'::bpchar))
);


--
-- Name: terminales; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.terminales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ciudad_id uuid NOT NULL,
    nombre text NOT NULL,
    direccion text NOT NULL,
    latitud numeric(9,6),
    longitud numeric(9,6),
    CONSTRAINT terminales_latitud_check CHECK (((latitud >= ('-90'::integer)::numeric) AND (latitud <= (90)::numeric))),
    CONSTRAINT terminales_longitud_check CHECK (((longitud >= ('-180'::integer)::numeric) AND (longitud <= (180)::numeric)))
);


--
-- Name: tokens_acceso; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.tokens_acceso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    proposito text NOT NULL,
    token_hash text NOT NULL,
    nuevo_correo text,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    vence_en timestamp with time zone NOT NULL,
    consumido_en timestamp with time zone,
    revocado_en timestamp with time zone,
    CONSTRAINT tokens_acceso_check CHECK ((vence_en > creado_en)),
    CONSTRAINT tokens_acceso_proposito_check CHECK ((proposito = ANY (ARRAY['REFRESH'::text, 'RECUPERAR_CLAVE'::text, 'VERIFICAR_CORREO'::text, 'CAMBIAR_CORREO'::text])))
);


--
-- Name: usuarios; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    correo text NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    tipo_documento text NOT NULL,
    pais_documento character(2) DEFAULT 'EC'::bpchar NOT NULL,
    numero_documento text NOT NULL,
    telefono text NOT NULL,
    password_hash text NOT NULL,
    correo_verificado_en timestamp with time zone,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT usuarios_correo_check CHECK ((correo ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'::text)),
    CONSTRAINT usuarios_nombres_check CHECK ((btrim(nombres) <> ''::text)),
    CONSTRAINT usuarios_tipo_documento_check CHECK ((tipo_documento = ANY (ARRAY['CEDULA'::text, 'PASAPORTE'::text, 'OTRO'::text])))
);


--
-- Name: v_boletos_compra; Type: VIEW; Schema: rutaec; Owner: -
--

CREATE VIEW rutaec.v_boletos_compra AS
 SELECT b.id,
    b.compra_id,
    c.comprador_id,
    c.cooperativa_id,
    b.codigo,
    b.estado,
    b.emitido_en,
    b.pdf_archivo_id,
    d.pasajero_id,
    d.asiento_snapshot,
    d.importe
   FROM ((rutaec.boletos b
     JOIN rutaec.compras c ON ((c.id = b.compra_id)))
     JOIN rutaec.detalle_compra d ON ((d.id = b.detalle_id)));


--
-- Name: v_dias_parada; Type: VIEW; Schema: rutaec; Owner: -
--

CREATE VIEW rutaec.v_dias_parada AS
 SELECT cooperativa_id,
    bus_id,
    inicio,
    fin,
    tipo,
    motivo
   FROM rutaec.agenda_bus
  WHERE (activa AND (tipo = ANY (ARRAY['DESCANSO'::text, 'MANTENIMIENTO'::text])));


--
-- Name: viajes; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.viajes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cooperativa_id uuid NOT NULL,
    hoja_ruta_id uuid NOT NULL,
    frecuencia_id uuid NOT NULL,
    ruta_id uuid NOT NULL,
    bus_id uuid NOT NULL,
    agenda_id uuid NOT NULL,
    estado text DEFAULT 'BORRADOR'::text NOT NULL,
    cierre_ventas timestamp with time zone NOT NULL,
    publicado_en timestamp with time zone,
    motivo_cancelacion text,
    CONSTRAINT viajes_check CHECK (((estado <> 'CANCELADO'::text) OR (NULLIF(btrim(motivo_cancelacion), ''::text) IS NOT NULL))),
    CONSTRAINT viajes_estado_check CHECK ((estado = ANY (ARRAY['BORRADOR'::text, 'PUBLICADO'::text, 'CERRADO'::text, 'CANCELADO'::text])))
);


--
-- Name: v_ocupacion_tramos; Type: VIEW; Schema: rutaec; Owner: -
--

CREATE VIEW rutaec.v_ocupacion_tramos AS
 SELECT v.cooperativa_id,
    v.id AS viaje_id,
    p.orden AS tramo_inicio,
    (p.orden + 1) AS tramo_fin,
    ( SELECT count(*) AS count
           FROM rutaec.asientos_viaje s
          WHERE ((s.viaje_id = v.id) AND s.vendible)) AS capacidad_vendible,
    count(d.id) FILTER (WHERE (d.estado = 'CONFIRMADO'::text)) AS vendidos,
    count(d.id) FILTER (WHERE ((d.estado = 'RETENIDO'::text) AND ((c.estado = 'EN_REVISION'::text) OR ((c.estado = 'RESERVADA'::text) AND (c.vence_en > clock_timestamp()))))) AS retenidos
   FROM ((((rutaec.viajes v
     JOIN rutaec.paradas_viaje p ON ((p.viaje_id = v.id)))
     JOIN rutaec.paradas_viaje siguiente ON (((siguiente.viaje_id = p.viaje_id) AND (siguiente.orden = (p.orden + 1)))))
     LEFT JOIN rutaec.detalle_compra d ON (((d.viaje_id = v.id) AND (d.tramo @> p.orden) AND (d.estado = ANY (ARRAY['RETENIDO'::text, 'CONFIRMADO'::text])))))
     LEFT JOIN rutaec.compras c ON ((c.id = d.compra_id)))
  GROUP BY v.cooperativa_id, v.id, p.orden;


--
-- Name: v_pagos_diarios; Type: VIEW; Schema: rutaec; Owner: -
--

CREATE VIEW rutaec.v_pagos_diarios AS
 SELECT cooperativa_id,
    ((recibido_en AT TIME ZONE 'America/Guayaquil'::text))::date AS fecha,
    metodo,
    estado,
    moneda_recibida,
    count(*) AS operaciones,
    sum(importe_recibido) AS importe_recibido
   FROM rutaec.pagos
  WHERE (importe_recibido IS NOT NULL)
  GROUP BY cooperativa_id, (((recibido_en AT TIME ZONE 'America/Guayaquil'::text))::date), metodo, estado, moneda_recibida;


--
-- Name: v_revisiones_atrasadas; Type: VIEW; Schema: rutaec; Owner: -
--

CREATE VIEW rutaec.v_revisiones_atrasadas AS
 SELECT id,
    cooperativa_id,
    tipo,
    pago_id,
    validacion_id,
    asignado_a,
    estado,
    creado_en,
    tomado_en,
    resuelto_en,
    alertado_en,
    motivo,
    (clock_timestamp() - creado_en) AS tiempo_espera
   FROM rutaec.revisiones r
  WHERE ((tipo = 'PAGO'::text) AND (estado = ANY (ARRAY['PENDIENTE'::text, 'EN_REVISION'::text, 'CORRECCION'::text])) AND (creado_en <= (clock_timestamp() - '00:15:00'::interval)));


--
-- Name: v_ventas_diarias; Type: VIEW; Schema: rutaec; Owner: -
--

CREATE VIEW rutaec.v_ventas_diarias AS
 SELECT cooperativa_id,
    ((confirmada_en AT TIME ZONE 'America/Guayaquil'::text))::date AS fecha,
    count(*) AS compras_confirmadas,
    sum(total) AS venta_bruta_usd
   FROM rutaec.compras
  WHERE (estado = 'CONFIRMADA'::text)
  GROUP BY cooperativa_id, (((confirmada_en AT TIME ZONE 'America/Guayaquil'::text))::date);


--
-- Name: validaciones_descuento; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.validaciones_descuento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pasajero_id uuid NOT NULL,
    cooperativa_id uuid NOT NULL,
    politica_id uuid NOT NULL,
    documento_id uuid NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    valido_desde date NOT NULL,
    valido_hasta date NOT NULL,
    revisado_por uuid,
    revisado_en timestamp with time zone,
    motivo text,
    CONSTRAINT validaciones_descuento_check CHECK ((valido_hasta >= valido_desde)),
    CONSTRAINT validaciones_descuento_check1 CHECK (((estado = 'PENDIENTE'::text) OR ((revisado_por IS NOT NULL) AND (revisado_en IS NOT NULL)))),
    CONSTRAINT validaciones_descuento_check2 CHECK (((estado <> ALL (ARRAY['RECHAZADA'::text, 'CORRECCION'::text])) OR (NULLIF(btrim(motivo), ''::text) IS NOT NULL))),
    CONSTRAINT validaciones_descuento_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'APROBADA'::text, 'RECHAZADA'::text, 'CORRECCION'::text])))
);


--
-- Name: versiones_esquema; Type: TABLE; Schema: rutaec; Owner: -
--

CREATE TABLE rutaec.versiones_esquema (
    numero integer NOT NULL,
    entrega_objetivo text NOT NULL,
    descripcion text NOT NULL,
    aplicada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: agenda_bus agenda_bus_id_bus_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.agenda_bus
    ADD CONSTRAINT agenda_bus_id_bus_id_cooperativa_id_key UNIQUE (id, bus_id, cooperativa_id);


--
-- Name: agenda_bus agenda_bus_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.agenda_bus
    ADD CONSTRAINT agenda_bus_pkey PRIMARY KEY (id);


--
-- Name: archivos archivos_objeto_clave_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.archivos
    ADD CONSTRAINT archivos_objeto_clave_key UNIQUE (objeto_clave);


--
-- Name: archivos archivos_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.archivos
    ADD CONSTRAINT archivos_pkey PRIMARY KEY (id);


--
-- Name: asientos_bus asientos_bus_bus_id_numero_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_bus
    ADD CONSTRAINT asientos_bus_bus_id_numero_key UNIQUE (bus_id, numero);


--
-- Name: asientos_bus asientos_bus_bus_id_piso_fila_columna_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_bus
    ADD CONSTRAINT asientos_bus_bus_id_piso_fila_columna_key UNIQUE (bus_id, piso, fila, columna);


--
-- Name: asientos_bus asientos_bus_id_bus_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_bus
    ADD CONSTRAINT asientos_bus_id_bus_id_key UNIQUE (id, bus_id);


--
-- Name: asientos_bus asientos_bus_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_bus
    ADD CONSTRAINT asientos_bus_pkey PRIMARY KEY (id);


--
-- Name: asientos_viaje asientos_viaje_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_viaje
    ADD CONSTRAINT asientos_viaje_pkey PRIMARY KEY (viaje_id, id);


--
-- Name: asientos_viaje asientos_viaje_viaje_id_numero_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_viaje
    ADD CONSTRAINT asientos_viaje_viaje_id_numero_key UNIQUE (viaje_id, numero);


--
-- Name: asientos_viaje asientos_viaje_viaje_id_piso_fila_columna_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_viaje
    ADD CONSTRAINT asientos_viaje_viaje_id_piso_fila_columna_key UNIQUE (viaje_id, piso, fila, columna);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: boletos boletos_codigo_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.boletos
    ADD CONSTRAINT boletos_codigo_key UNIQUE (codigo);


--
-- Name: boletos boletos_detalle_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.boletos
    ADD CONSTRAINT boletos_detalle_id_key UNIQUE (detalle_id);


--
-- Name: boletos boletos_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.boletos
    ADD CONSTRAINT boletos_pkey PRIMARY KEY (id);


--
-- Name: boletos boletos_qr_token_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.boletos
    ADD CONSTRAINT boletos_qr_token_key UNIQUE (qr_token);


--
-- Name: bus_comodidades bus_comodidades_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.bus_comodidades
    ADD CONSTRAINT bus_comodidades_pkey PRIMARY KEY (bus_id, comodidad);


--
-- Name: buses buses_cooperativa_id_numero_unidad_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.buses
    ADD CONSTRAINT buses_cooperativa_id_numero_unidad_key UNIQUE (cooperativa_id, numero_unidad);


--
-- Name: buses buses_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.buses
    ADD CONSTRAINT buses_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: buses buses_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.buses
    ADD CONSTRAINT buses_pkey PRIMARY KEY (id);


--
-- Name: buses buses_placa_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.buses
    ADD CONSTRAINT buses_placa_key UNIQUE (placa);


--
-- Name: ciudades ciudades_pais_provincia_nombre_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.ciudades
    ADD CONSTRAINT ciudades_pais_provincia_nombre_key UNIQUE (pais, provincia, nombre);


--
-- Name: ciudades ciudades_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.ciudades
    ADD CONSTRAINT ciudades_pkey PRIMARY KEY (id);


--
-- Name: comodidades comodidades_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.comodidades
    ADD CONSTRAINT comodidades_pkey PRIMARY KEY (codigo);


--
-- Name: compras compras_codigo_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_codigo_key UNIQUE (codigo);


--
-- Name: compras compras_id_comprador_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_id_comprador_id_key UNIQUE (id, comprador_id);


--
-- Name: compras compras_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: compras compras_id_viaje_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_id_viaje_id_cooperativa_id_key UNIQUE (id, viaje_id, cooperativa_id);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- Name: comprobantes_pago comprobantes_pago_archivo_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.comprobantes_pago
    ADD CONSTRAINT comprobantes_pago_archivo_id_key UNIQUE (archivo_id);


--
-- Name: comprobantes_pago comprobantes_pago_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.comprobantes_pago
    ADD CONSTRAINT comprobantes_pago_pkey PRIMARY KEY (id);


--
-- Name: cooperativas cooperativas_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cooperativas
    ADD CONSTRAINT cooperativas_pkey PRIMARY KEY (id);


--
-- Name: cooperativas cooperativas_ruc_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cooperativas
    ADD CONSTRAINT cooperativas_ruc_key UNIQUE (ruc);


--
-- Name: cuentas_bancarias cuentas_bancarias_cooperativa_id_banco_numero_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_cooperativa_id_banco_numero_key UNIQUE (cooperativa_id, banco, numero);


--
-- Name: cuentas_bancarias cuentas_bancarias_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: cuentas_bancarias cuentas_bancarias_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_pkey PRIMARY KEY (id);


--
-- Name: detalle_compra detalle_compra_compra_id_pasajero_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_compra_id_pasajero_id_key UNIQUE (compra_id, pasajero_id);


--
-- Name: detalle_compra detalle_compra_id_compra_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_id_compra_id_key UNIQUE (id, compra_id);


--
-- Name: detalle_compra detalle_compra_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_pkey PRIMARY KEY (id);


--
-- Name: dias_frecuencia dias_frecuencia_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.dias_frecuencia
    ADD CONSTRAINT dias_frecuencia_pkey PRIMARY KEY (frecuencia_id, dia_iso);


--
-- Name: documentos_pasajero documentos_pasajero_id_pasajero_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.documentos_pasajero
    ADD CONSTRAINT documentos_pasajero_id_pasajero_id_key UNIQUE (id, pasajero_id);


--
-- Name: documentos_pasajero documentos_pasajero_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.documentos_pasajero
    ADD CONSTRAINT documentos_pasajero_pkey PRIMARY KEY (id);


--
-- Name: envios_correo envios_correo_clave_deduplicacion_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.envios_correo
    ADD CONSTRAINT envios_correo_clave_deduplicacion_key UNIQUE (clave_deduplicacion);


--
-- Name: envios_correo envios_correo_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.envios_correo
    ADD CONSTRAINT envios_correo_pkey PRIMARY KEY (id);


--
-- Name: eventos_proveedor eventos_proveedor_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.eventos_proveedor
    ADD CONSTRAINT eventos_proveedor_pkey PRIMARY KEY (id);


--
-- Name: eventos_proveedor eventos_proveedor_proveedor_evento_externo_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.eventos_proveedor
    ADD CONSTRAINT eventos_proveedor_proveedor_evento_externo_id_key UNIQUE (proveedor, evento_externo_id);


--
-- Name: eventos_salida eventos_salida_clave_deduplicacion_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.eventos_salida
    ADD CONSTRAINT eventos_salida_clave_deduplicacion_key UNIQUE (clave_deduplicacion);


--
-- Name: eventos_salida eventos_salida_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.eventos_salida
    ADD CONSTRAINT eventos_salida_pkey PRIMARY KEY (id);


--
-- Name: frecuencias frecuencias_cooperativa_id_codigo_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_cooperativa_id_codigo_key UNIQUE (cooperativa_id, codigo);


--
-- Name: frecuencias frecuencias_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: frecuencias frecuencias_id_ruta_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_id_ruta_id_cooperativa_id_key UNIQUE (id, ruta_id, cooperativa_id);


--
-- Name: frecuencias frecuencias_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_pkey PRIMARY KEY (id);


--
-- Name: grupos_buses grupos_buses_cooperativa_id_nombre_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.grupos_buses
    ADD CONSTRAINT grupos_buses_cooperativa_id_nombre_key UNIQUE (cooperativa_id, nombre);


--
-- Name: grupos_buses grupos_buses_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.grupos_buses
    ADD CONSTRAINT grupos_buses_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: grupos_buses grupos_buses_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.grupos_buses
    ADD CONSTRAINT grupos_buses_pkey PRIMARY KEY (id);


--
-- Name: historial_revisiones historial_revisiones_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.historial_revisiones
    ADD CONSTRAINT historial_revisiones_pkey PRIMARY KEY (id);


--
-- Name: hojas_ruta hojas_ruta_grupo_id_fecha_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.hojas_ruta
    ADD CONSTRAINT hojas_ruta_grupo_id_fecha_key UNIQUE (grupo_id, fecha);


--
-- Name: hojas_ruta hojas_ruta_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.hojas_ruta
    ADD CONSTRAINT hojas_ruta_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: hojas_ruta hojas_ruta_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.hojas_ruta
    ADD CONSTRAINT hojas_ruta_pkey PRIMARY KEY (id);


--
-- Name: incidencias incidencias_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.incidencias
    ADD CONSTRAINT incidencias_pkey PRIMARY KEY (id);


--
-- Name: miembros_cooperativa miembros_cooperativa_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.miembros_cooperativa
    ADD CONSTRAINT miembros_cooperativa_pkey PRIMARY KEY (cooperativa_id, usuario_id);


--
-- Name: notificaciones notificaciones_clave_deduplicacion_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.notificaciones
    ADD CONSTRAINT notificaciones_clave_deduplicacion_key UNIQUE (clave_deduplicacion);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_clave_idempotencia_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- Name: pagos pagos_id_compra_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_id_compra_id_key UNIQUE (id, compra_id);


--
-- Name: pagos pagos_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_proveedor_referencia_proveedor_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_proveedor_referencia_proveedor_key UNIQUE (proveedor, referencia_proveedor);


--
-- Name: paradas_ruta paradas_ruta_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.paradas_ruta
    ADD CONSTRAINT paradas_ruta_pkey PRIMARY KEY (ruta_id, orden);


--
-- Name: paradas_viaje paradas_viaje_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.paradas_viaje
    ADD CONSTRAINT paradas_viaje_pkey PRIMARY KEY (viaje_id, orden);


--
-- Name: pasajeros pasajeros_comprador_id_pais_documento_tipo_documento_numero_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pasajeros
    ADD CONSTRAINT pasajeros_comprador_id_pais_documento_tipo_documento_numero_key UNIQUE (comprador_id, pais_documento, tipo_documento, numero_documento);


--
-- Name: pasajeros pasajeros_id_comprador_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pasajeros
    ADD CONSTRAINT pasajeros_id_comprador_id_key UNIQUE (id, comprador_id);


--
-- Name: pasajeros pasajeros_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pasajeros
    ADD CONSTRAINT pasajeros_pkey PRIMARY KEY (id);


--
-- Name: politicas_descuento politicas_descuento_codigo_version_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.politicas_descuento
    ADD CONSTRAINT politicas_descuento_codigo_version_key UNIQUE (codigo, version);


--
-- Name: politicas_descuento politicas_descuento_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.politicas_descuento
    ADD CONSTRAINT politicas_descuento_pkey PRIMARY KEY (id);


--
-- Name: reembolsos reembolsos_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.reembolsos
    ADD CONSTRAINT reembolsos_pkey PRIMARY KEY (id);


--
-- Name: resoluciones resoluciones_cooperativa_id_numero_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.resoluciones
    ADD CONSTRAINT resoluciones_cooperativa_id_numero_key UNIQUE (cooperativa_id, numero);


--
-- Name: resoluciones resoluciones_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.resoluciones
    ADD CONSTRAINT resoluciones_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: resoluciones resoluciones_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.resoluciones
    ADD CONSTRAINT resoluciones_pkey PRIMARY KEY (id);


--
-- Name: revisiones revisiones_pago_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_pago_id_key UNIQUE (pago_id);


--
-- Name: revisiones revisiones_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_pkey PRIMARY KEY (id);


--
-- Name: revisiones revisiones_validacion_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_validacion_id_key UNIQUE (validacion_id);


--
-- Name: roles_globales roles_globales_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.roles_globales
    ADD CONSTRAINT roles_globales_pkey PRIMARY KEY (usuario_id, rol);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (codigo);


--
-- Name: rutas rutas_cooperativa_id_nombre_version_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.rutas
    ADD CONSTRAINT rutas_cooperativa_id_nombre_version_key UNIQUE (cooperativa_id, nombre, version);


--
-- Name: rutas rutas_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.rutas
    ADD CONSTRAINT rutas_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: rutas rutas_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.rutas
    ADD CONSTRAINT rutas_pkey PRIMARY KEY (id);


--
-- Name: servicios_contratados servicios_contratados_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.servicios_contratados
    ADD CONSTRAINT servicios_contratados_pkey PRIMARY KEY (id);


--
-- Name: tarifas_viaje tarifas_viaje_id_viaje_id_origen_orden_destino_orden_catego_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tarifas_viaje
    ADD CONSTRAINT tarifas_viaje_id_viaje_id_origen_orden_destino_orden_catego_key UNIQUE (id, viaje_id, origen_orden, destino_orden, categoria);


--
-- Name: tarifas_viaje tarifas_viaje_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tarifas_viaje
    ADD CONSTRAINT tarifas_viaje_pkey PRIMARY KEY (id);


--
-- Name: tarifas_viaje tarifas_viaje_viaje_id_origen_orden_destino_orden_categoria_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tarifas_viaje
    ADD CONSTRAINT tarifas_viaje_viaje_id_origen_orden_destino_orden_categoria_key UNIQUE (viaje_id, origen_orden, destino_orden, categoria);


--
-- Name: terminales terminales_ciudad_id_nombre_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.terminales
    ADD CONSTRAINT terminales_ciudad_id_nombre_key UNIQUE (ciudad_id, nombre);


--
-- Name: terminales terminales_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.terminales
    ADD CONSTRAINT terminales_pkey PRIMARY KEY (id);


--
-- Name: tokens_acceso tokens_acceso_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tokens_acceso
    ADD CONSTRAINT tokens_acceso_pkey PRIMARY KEY (id);


--
-- Name: tokens_acceso tokens_acceso_token_hash_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tokens_acceso
    ADD CONSTRAINT tokens_acceso_token_hash_key UNIQUE (token_hash);


--
-- Name: usuarios usuarios_pais_documento_tipo_documento_numero_documento_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.usuarios
    ADD CONSTRAINT usuarios_pais_documento_tipo_documento_numero_documento_key UNIQUE (pais_documento, tipo_documento, numero_documento);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: validaciones_descuento validaciones_descuento_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: validaciones_descuento validaciones_descuento_id_pasajero_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_id_pasajero_id_cooperativa_id_key UNIQUE (id, pasajero_id, cooperativa_id);


--
-- Name: validaciones_descuento validaciones_descuento_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_pkey PRIMARY KEY (id);


--
-- Name: versiones_esquema versiones_esquema_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.versiones_esquema
    ADD CONSTRAINT versiones_esquema_pkey PRIMARY KEY (numero);


--
-- Name: viajes viajes_agenda_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_agenda_id_key UNIQUE (agenda_id);


--
-- Name: viajes viajes_id_cooperativa_id_key; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_id_cooperativa_id_key UNIQUE (id, cooperativa_id);


--
-- Name: viajes viajes_pkey; Type: CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_pkey PRIMARY KEY (id);


--
-- Name: archivos_propietario_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX archivos_propietario_idx ON rutaec.archivos USING btree (propietario_id);


--
-- Name: auditoria_fecha_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX auditoria_fecha_idx ON rutaec.auditoria USING btree (cooperativa_id, creado_en DESC);


--
-- Name: compras_cliente_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX compras_cliente_idx ON rutaec.compras USING btree (comprador_id, creada_en DESC);


--
-- Name: compras_cooperativa_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX compras_cooperativa_idx ON rutaec.compras USING btree (cooperativa_id, creada_en DESC);


--
-- Name: compras_vencimiento_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX compras_vencimiento_idx ON rutaec.compras USING btree (vence_en) WHERE (estado = 'RESERVADA'::text);


--
-- Name: correo_pendiente_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX correo_pendiente_idx ON rutaec.envios_correo USING btree (estado, proximo_intento_en);


--
-- Name: detalle_viaje_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX detalle_viaje_idx ON rutaec.detalle_compra USING btree (viaje_id, estado);


--
-- Name: eventos_pendientes_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX eventos_pendientes_idx ON rutaec.eventos_salida USING btree (estado, disponible_en);


--
-- Name: incidencias_pendientes_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX incidencias_pendientes_idx ON rutaec.incidencias USING btree (cooperativa_id, estado, creado_en);


--
-- Name: miembros_usuario_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX miembros_usuario_idx ON rutaec.miembros_cooperativa USING btree (usuario_id) WHERE activo;


--
-- Name: notificaciones_usuario_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX notificaciones_usuario_idx ON rutaec.notificaciones USING btree (usuario_id, creada_en DESC);


--
-- Name: pago_abierto_uq; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE UNIQUE INDEX pago_abierto_uq ON rutaec.pagos USING btree (compra_id) WHERE (estado = ANY (ARRAY['PENDIENTE'::text, 'EN_REVISION'::text, 'CORRECCION'::text]));


--
-- Name: pagos_compra_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX pagos_compra_idx ON rutaec.pagos USING btree (compra_id);


--
-- Name: pasajeros_comprador_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX pasajeros_comprador_idx ON rutaec.pasajeros USING btree (comprador_id);


--
-- Name: revisiones_bandeja_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX revisiones_bandeja_idx ON rutaec.revisiones USING btree (cooperativa_id, estado, creado_en);


--
-- Name: usuarios_correo_uq; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE UNIQUE INDEX usuarios_correo_uq ON rutaec.usuarios USING btree (lower(correo));


--
-- Name: viajes_bus_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX viajes_bus_idx ON rutaec.viajes USING btree (bus_id);


--
-- Name: viajes_cooperativa_idx; Type: INDEX; Schema: rutaec; Owner: -
--

CREATE INDEX viajes_cooperativa_idx ON rutaec.viajes USING btree (cooperativa_id, estado, cierre_ventas);


--
-- Name: agenda_bus agenda_protegida; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER agenda_protegida BEFORE DELETE OR UPDATE ON rutaec.agenda_bus FOR EACH ROW EXECUTE FUNCTION rutaec.proteger_agenda();


--
-- Name: compras auditar_compras; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER auditar_compras AFTER INSERT OR UPDATE ON rutaec.compras FOR EACH ROW EXECUTE FUNCTION rutaec.auditar_estado();


--
-- Name: cooperativas auditar_cooperativas; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER auditar_cooperativas AFTER UPDATE ON rutaec.cooperativas FOR EACH ROW EXECUTE FUNCTION rutaec.auditar_estado();


--
-- Name: pagos auditar_pagos; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER auditar_pagos AFTER INSERT OR UPDATE ON rutaec.pagos FOR EACH ROW EXECUTE FUNCTION rutaec.auditar_estado();


--
-- Name: revisiones auditar_revisiones; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER auditar_revisiones AFTER INSERT OR UPDATE ON rutaec.revisiones FOR EACH ROW EXECUTE FUNCTION rutaec.auditar_estado();


--
-- Name: validaciones_descuento auditar_validaciones; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER auditar_validaciones AFTER INSERT OR UPDATE ON rutaec.validaciones_descuento FOR EACH ROW EXECUTE FUNCTION rutaec.auditar_estado();


--
-- Name: auditoria auditoria_inmutable; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER auditoria_inmutable BEFORE DELETE OR UPDATE ON rutaec.auditoria FOR EACH ROW EXECUTE FUNCTION rutaec.proteger_auditoria();


--
-- Name: compras compra_cambio; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER compra_cambio AFTER UPDATE OF estado ON rutaec.compras FOR EACH ROW EXECUTE FUNCTION rutaec.sincronizar_compra();


--
-- Name: documentos_pasajero documento_valido; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER documento_valido BEFORE INSERT OR UPDATE ON rutaec.documentos_pasajero FOR EACH ROW EXECUTE FUNCTION rutaec.validar_documento();


--
-- Name: asientos_viaje proteger_asientos; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER proteger_asientos BEFORE INSERT OR DELETE OR UPDATE ON rutaec.asientos_viaje FOR EACH ROW EXECUTE FUNCTION rutaec.proteger_snapshot_viaje();


--
-- Name: paradas_viaje proteger_paradas; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER proteger_paradas BEFORE INSERT OR DELETE OR UPDATE ON rutaec.paradas_viaje FOR EACH ROW EXECUTE FUNCTION rutaec.proteger_snapshot_viaje();


--
-- Name: tarifas_viaje proteger_tarifas; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER proteger_tarifas BEFORE INSERT OR DELETE OR UPDATE ON rutaec.tarifas_viaje FOR EACH ROW EXECUTE FUNCTION rutaec.proteger_snapshot_viaje();


--
-- Name: viajes viaje_publicacion; Type: TRIGGER; Schema: rutaec; Owner: -
--

CREATE TRIGGER viaje_publicacion BEFORE INSERT OR UPDATE ON rutaec.viajes FOR EACH ROW EXECUTE FUNCTION rutaec.validar_publicacion();


--
-- Name: agenda_bus agenda_bus_bus_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.agenda_bus
    ADD CONSTRAINT agenda_bus_bus_id_cooperativa_id_fkey FOREIGN KEY (bus_id, cooperativa_id) REFERENCES rutaec.buses(id, cooperativa_id);


--
-- Name: agenda_bus agenda_bus_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.agenda_bus
    ADD CONSTRAINT agenda_bus_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: archivos archivos_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.archivos
    ADD CONSTRAINT archivos_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: archivos archivos_propietario_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.archivos
    ADD CONSTRAINT archivos_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES rutaec.usuarios(id);


--
-- Name: asientos_bus asientos_bus_bus_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_bus
    ADD CONSTRAINT asientos_bus_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES rutaec.buses(id);


--
-- Name: asientos_viaje asientos_viaje_viaje_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.asientos_viaje
    ADD CONSTRAINT asientos_viaje_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES rutaec.viajes(id);


--
-- Name: auditoria auditoria_actor_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.auditoria
    ADD CONSTRAINT auditoria_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES rutaec.usuarios(id);


--
-- Name: auditoria auditoria_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.auditoria
    ADD CONSTRAINT auditoria_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: boletos boletos_detalle_id_compra_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.boletos
    ADD CONSTRAINT boletos_detalle_id_compra_id_fkey FOREIGN KEY (detalle_id, compra_id) REFERENCES rutaec.detalle_compra(id, compra_id);


--
-- Name: boletos boletos_pdf_archivo_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.boletos
    ADD CONSTRAINT boletos_pdf_archivo_id_fkey FOREIGN KEY (pdf_archivo_id) REFERENCES rutaec.archivos(id);


--
-- Name: bus_comodidades bus_comodidades_bus_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.bus_comodidades
    ADD CONSTRAINT bus_comodidades_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES rutaec.buses(id);


--
-- Name: bus_comodidades bus_comodidades_comodidad_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.bus_comodidades
    ADD CONSTRAINT bus_comodidades_comodidad_fkey FOREIGN KEY (comodidad) REFERENCES rutaec.comodidades(codigo);


--
-- Name: buses buses_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.buses
    ADD CONSTRAINT buses_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: buses buses_grupo_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.buses
    ADD CONSTRAINT buses_grupo_id_cooperativa_id_fkey FOREIGN KEY (grupo_id, cooperativa_id) REFERENCES rutaec.grupos_buses(id, cooperativa_id);


--
-- Name: compras compras_comprador_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_comprador_id_fkey FOREIGN KEY (comprador_id) REFERENCES rutaec.usuarios(id);


--
-- Name: compras compras_creado_por_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES rutaec.usuarios(id);


--
-- Name: compras compras_viaje_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.compras
    ADD CONSTRAINT compras_viaje_id_cooperativa_id_fkey FOREIGN KEY (viaje_id, cooperativa_id) REFERENCES rutaec.viajes(id, cooperativa_id);


--
-- Name: comprobantes_pago comprobantes_pago_archivo_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.comprobantes_pago
    ADD CONSTRAINT comprobantes_pago_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES rutaec.archivos(id);


--
-- Name: comprobantes_pago comprobantes_pago_pago_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.comprobantes_pago
    ADD CONSTRAINT comprobantes_pago_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES rutaec.pagos(id);


--
-- Name: cooperativas cooperativas_logo_archivo_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cooperativas
    ADD CONSTRAINT cooperativas_logo_archivo_id_fkey FOREIGN KEY (logo_archivo_id) REFERENCES rutaec.archivos(id);


--
-- Name: cuentas_bancarias cuentas_bancarias_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: detalle_compra detalle_compra_compra_id_comprador_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_compra_id_comprador_id_fkey FOREIGN KEY (compra_id, comprador_id) REFERENCES rutaec.compras(id, comprador_id);


--
-- Name: detalle_compra detalle_compra_compra_id_viaje_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_compra_id_viaje_id_cooperativa_id_fkey FOREIGN KEY (compra_id, viaje_id, cooperativa_id) REFERENCES rutaec.compras(id, viaje_id, cooperativa_id);


--
-- Name: detalle_compra detalle_compra_pasajero_id_comprador_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_pasajero_id_comprador_id_fkey FOREIGN KEY (pasajero_id, comprador_id) REFERENCES rutaec.pasajeros(id, comprador_id);


--
-- Name: detalle_compra detalle_compra_tarifa_id_viaje_id_origen_orden_destino_ord_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_tarifa_id_viaje_id_origen_orden_destino_ord_fkey FOREIGN KEY (tarifa_id, viaje_id, origen_orden, destino_orden, categoria) REFERENCES rutaec.tarifas_viaje(id, viaje_id, origen_orden, destino_orden, categoria);


--
-- Name: detalle_compra detalle_compra_validacion_descuento_id_pasajero_id_coopera_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_validacion_descuento_id_pasajero_id_coopera_fkey FOREIGN KEY (validacion_descuento_id, pasajero_id, cooperativa_id) REFERENCES rutaec.validaciones_descuento(id, pasajero_id, cooperativa_id);


--
-- Name: detalle_compra detalle_compra_viaje_id_asiento_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.detalle_compra
    ADD CONSTRAINT detalle_compra_viaje_id_asiento_id_fkey FOREIGN KEY (viaje_id, asiento_id) REFERENCES rutaec.asientos_viaje(viaje_id, id);


--
-- Name: dias_frecuencia dias_frecuencia_frecuencia_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.dias_frecuencia
    ADD CONSTRAINT dias_frecuencia_frecuencia_id_fkey FOREIGN KEY (frecuencia_id) REFERENCES rutaec.frecuencias(id);


--
-- Name: documentos_pasajero documentos_pasajero_archivo_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.documentos_pasajero
    ADD CONSTRAINT documentos_pasajero_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES rutaec.archivos(id);


--
-- Name: documentos_pasajero documentos_pasajero_pasajero_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.documentos_pasajero
    ADD CONSTRAINT documentos_pasajero_pasajero_id_fkey FOREIGN KEY (pasajero_id) REFERENCES rutaec.pasajeros(id);


--
-- Name: envios_correo envios_correo_adjunto_archivo_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.envios_correo
    ADD CONSTRAINT envios_correo_adjunto_archivo_id_fkey FOREIGN KEY (adjunto_archivo_id) REFERENCES rutaec.archivos(id);


--
-- Name: envios_correo envios_correo_compra_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.envios_correo
    ADD CONSTRAINT envios_correo_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES rutaec.compras(id);


--
-- Name: envios_correo envios_correo_evento_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.envios_correo
    ADD CONSTRAINT envios_correo_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES rutaec.eventos_salida(id);


--
-- Name: eventos_proveedor eventos_proveedor_pago_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.eventos_proveedor
    ADD CONSTRAINT eventos_proveedor_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES rutaec.pagos(id);


--
-- Name: eventos_salida eventos_salida_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.eventos_salida
    ADD CONSTRAINT eventos_salida_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: frecuencias frecuencias_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: frecuencias frecuencias_resolucion_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_resolucion_id_cooperativa_id_fkey FOREIGN KEY (resolucion_id, cooperativa_id) REFERENCES rutaec.resoluciones(id, cooperativa_id);


--
-- Name: frecuencias frecuencias_ruta_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.frecuencias
    ADD CONSTRAINT frecuencias_ruta_id_cooperativa_id_fkey FOREIGN KEY (ruta_id, cooperativa_id) REFERENCES rutaec.rutas(id, cooperativa_id);


--
-- Name: grupos_buses grupos_buses_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.grupos_buses
    ADD CONSTRAINT grupos_buses_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: historial_revisiones historial_revisiones_actor_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.historial_revisiones
    ADD CONSTRAINT historial_revisiones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES rutaec.usuarios(id);


--
-- Name: historial_revisiones historial_revisiones_revision_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.historial_revisiones
    ADD CONSTRAINT historial_revisiones_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES rutaec.revisiones(id);


--
-- Name: hojas_ruta hojas_ruta_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.hojas_ruta
    ADD CONSTRAINT hojas_ruta_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: hojas_ruta hojas_ruta_creado_por_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.hojas_ruta
    ADD CONSTRAINT hojas_ruta_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES rutaec.usuarios(id);


--
-- Name: hojas_ruta hojas_ruta_grupo_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.hojas_ruta
    ADD CONSTRAINT hojas_ruta_grupo_id_cooperativa_id_fkey FOREIGN KEY (grupo_id, cooperativa_id) REFERENCES rutaec.grupos_buses(id, cooperativa_id);


--
-- Name: incidencias incidencias_asignado_a_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.incidencias
    ADD CONSTRAINT incidencias_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES rutaec.usuarios(id);


--
-- Name: incidencias incidencias_compra_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.incidencias
    ADD CONSTRAINT incidencias_compra_id_cooperativa_id_fkey FOREIGN KEY (compra_id, cooperativa_id) REFERENCES rutaec.compras(id, cooperativa_id);


--
-- Name: incidencias incidencias_creado_por_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.incidencias
    ADD CONSTRAINT incidencias_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES rutaec.usuarios(id);


--
-- Name: incidencias incidencias_pago_id_compra_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.incidencias
    ADD CONSTRAINT incidencias_pago_id_compra_id_fkey FOREIGN KEY (pago_id, compra_id) REFERENCES rutaec.pagos(id, compra_id);


--
-- Name: miembros_cooperativa miembros_cooperativa_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.miembros_cooperativa
    ADD CONSTRAINT miembros_cooperativa_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: miembros_cooperativa miembros_cooperativa_rol_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.miembros_cooperativa
    ADD CONSTRAINT miembros_cooperativa_rol_fkey FOREIGN KEY (rol) REFERENCES rutaec.roles(codigo);


--
-- Name: miembros_cooperativa miembros_cooperativa_usuario_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.miembros_cooperativa
    ADD CONSTRAINT miembros_cooperativa_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES rutaec.usuarios(id);


--
-- Name: notificaciones notificaciones_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.notificaciones
    ADD CONSTRAINT notificaciones_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: notificaciones notificaciones_evento_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.notificaciones
    ADD CONSTRAINT notificaciones_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES rutaec.eventos_salida(id);


--
-- Name: notificaciones notificaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.notificaciones
    ADD CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES rutaec.usuarios(id);


--
-- Name: pagos pagos_compra_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_compra_id_cooperativa_id_fkey FOREIGN KEY (compra_id, cooperativa_id) REFERENCES rutaec.compras(id, cooperativa_id);


--
-- Name: pagos pagos_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES rutaec.usuarios(id);


--
-- Name: pagos pagos_cuenta_bancaria_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pagos
    ADD CONSTRAINT pagos_cuenta_bancaria_id_cooperativa_id_fkey FOREIGN KEY (cuenta_bancaria_id, cooperativa_id) REFERENCES rutaec.cuentas_bancarias(id, cooperativa_id);


--
-- Name: paradas_ruta paradas_ruta_ruta_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.paradas_ruta
    ADD CONSTRAINT paradas_ruta_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES rutaec.rutas(id);


--
-- Name: paradas_ruta paradas_ruta_terminal_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.paradas_ruta
    ADD CONSTRAINT paradas_ruta_terminal_id_fkey FOREIGN KEY (terminal_id) REFERENCES rutaec.terminales(id);


--
-- Name: paradas_viaje paradas_viaje_terminal_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.paradas_viaje
    ADD CONSTRAINT paradas_viaje_terminal_id_fkey FOREIGN KEY (terminal_id) REFERENCES rutaec.terminales(id);


--
-- Name: paradas_viaje paradas_viaje_viaje_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.paradas_viaje
    ADD CONSTRAINT paradas_viaje_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES rutaec.viajes(id);


--
-- Name: pasajeros pasajeros_comprador_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.pasajeros
    ADD CONSTRAINT pasajeros_comprador_id_fkey FOREIGN KEY (comprador_id) REFERENCES rutaec.usuarios(id);


--
-- Name: reembolsos reembolsos_gestionado_por_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.reembolsos
    ADD CONSTRAINT reembolsos_gestionado_por_fkey FOREIGN KEY (gestionado_por) REFERENCES rutaec.usuarios(id);


--
-- Name: reembolsos reembolsos_incidencia_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.reembolsos
    ADD CONSTRAINT reembolsos_incidencia_id_fkey FOREIGN KEY (incidencia_id) REFERENCES rutaec.incidencias(id);


--
-- Name: reembolsos reembolsos_pago_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.reembolsos
    ADD CONSTRAINT reembolsos_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES rutaec.pagos(id);


--
-- Name: resoluciones resoluciones_archivo_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.resoluciones
    ADD CONSTRAINT resoluciones_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES rutaec.archivos(id);


--
-- Name: resoluciones resoluciones_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.resoluciones
    ADD CONSTRAINT resoluciones_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: revisiones revisiones_cooperativa_id_asignado_a_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_cooperativa_id_asignado_a_fkey FOREIGN KEY (cooperativa_id, asignado_a) REFERENCES rutaec.miembros_cooperativa(cooperativa_id, usuario_id);


--
-- Name: revisiones revisiones_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: revisiones revisiones_pago_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_pago_id_cooperativa_id_fkey FOREIGN KEY (pago_id, cooperativa_id) REFERENCES rutaec.pagos(id, cooperativa_id);


--
-- Name: revisiones revisiones_validacion_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_validacion_id_cooperativa_id_fkey FOREIGN KEY (validacion_id, cooperativa_id) REFERENCES rutaec.validaciones_descuento(id, cooperativa_id);


--
-- Name: revisiones revisiones_validacion_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.revisiones
    ADD CONSTRAINT revisiones_validacion_id_fkey FOREIGN KEY (validacion_id) REFERENCES rutaec.validaciones_descuento(id);


--
-- Name: roles_globales roles_globales_rol_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.roles_globales
    ADD CONSTRAINT roles_globales_rol_fkey FOREIGN KEY (rol) REFERENCES rutaec.roles(codigo);


--
-- Name: roles_globales roles_globales_usuario_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.roles_globales
    ADD CONSTRAINT roles_globales_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES rutaec.usuarios(id);


--
-- Name: rutas rutas_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.rutas
    ADD CONSTRAINT rutas_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: servicios_contratados servicios_contratados_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.servicios_contratados
    ADD CONSTRAINT servicios_contratados_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: tarifas_viaje tarifas_viaje_viaje_id_destino_orden_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tarifas_viaje
    ADD CONSTRAINT tarifas_viaje_viaje_id_destino_orden_fkey FOREIGN KEY (viaje_id, destino_orden) REFERENCES rutaec.paradas_viaje(viaje_id, orden);


--
-- Name: tarifas_viaje tarifas_viaje_viaje_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tarifas_viaje
    ADD CONSTRAINT tarifas_viaje_viaje_id_fkey FOREIGN KEY (viaje_id) REFERENCES rutaec.viajes(id);


--
-- Name: tarifas_viaje tarifas_viaje_viaje_id_origen_orden_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tarifas_viaje
    ADD CONSTRAINT tarifas_viaje_viaje_id_origen_orden_fkey FOREIGN KEY (viaje_id, origen_orden) REFERENCES rutaec.paradas_viaje(viaje_id, orden);


--
-- Name: terminales terminales_ciudad_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.terminales
    ADD CONSTRAINT terminales_ciudad_id_fkey FOREIGN KEY (ciudad_id) REFERENCES rutaec.ciudades(id);


--
-- Name: tokens_acceso tokens_acceso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.tokens_acceso
    ADD CONSTRAINT tokens_acceso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES rutaec.usuarios(id);


--
-- Name: validaciones_descuento validaciones_descuento_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: validaciones_descuento validaciones_descuento_documento_id_pasajero_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_documento_id_pasajero_id_fkey FOREIGN KEY (documento_id, pasajero_id) REFERENCES rutaec.documentos_pasajero(id, pasajero_id);


--
-- Name: validaciones_descuento validaciones_descuento_pasajero_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_pasajero_id_fkey FOREIGN KEY (pasajero_id) REFERENCES rutaec.pasajeros(id);


--
-- Name: validaciones_descuento validaciones_descuento_politica_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_politica_id_fkey FOREIGN KEY (politica_id) REFERENCES rutaec.politicas_descuento(id);


--
-- Name: validaciones_descuento validaciones_descuento_revisado_por_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.validaciones_descuento
    ADD CONSTRAINT validaciones_descuento_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES rutaec.usuarios(id);


--
-- Name: viajes viajes_agenda_id_bus_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_agenda_id_bus_id_cooperativa_id_fkey FOREIGN KEY (agenda_id, bus_id, cooperativa_id) REFERENCES rutaec.agenda_bus(id, bus_id, cooperativa_id);


--
-- Name: viajes viajes_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_cooperativa_id_fkey FOREIGN KEY (cooperativa_id) REFERENCES rutaec.cooperativas(id);


--
-- Name: viajes viajes_frecuencia_id_ruta_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_frecuencia_id_ruta_id_cooperativa_id_fkey FOREIGN KEY (frecuencia_id, ruta_id, cooperativa_id) REFERENCES rutaec.frecuencias(id, ruta_id, cooperativa_id);


--
-- Name: viajes viajes_hoja_ruta_id_cooperativa_id_fkey; Type: FK CONSTRAINT; Schema: rutaec; Owner: -
--

ALTER TABLE ONLY rutaec.viajes
    ADD CONSTRAINT viajes_hoja_ruta_id_cooperativa_id_fkey FOREIGN KEY (hoja_ruta_id, cooperativa_id) REFERENCES rutaec.hojas_ruta(id, cooperativa_id);


--
-- PostgreSQL database dump complete
--

\unrestrict gcGIbURvzWX0XbjPpp3QgA7zQTkOTYzdz6e2U3v00pj54EAraA79qB2QxhgOFC4


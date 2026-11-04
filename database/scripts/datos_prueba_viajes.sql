-- =============================================================================
-- Datos de prueba para la busqueda de viajes (SOLO DESARROLLO LOCAL)
--
-- Crea 2 cooperativas ficticias, 3 ciudades con terminal, 2 buses de 40
-- asientos, 2 rutas con tarifas por tramo y viajes PUBLICADOS para los
-- proximos 7 dias (hora de Ecuador).
--
--   Andes Express (prueba): Riobamba -> Ambato -> Quito   salida 07:00
--   Santa Prueba:           Ambato -> Quito               salida 09:30
--
-- Es repetible: si se vuelve a ejecutar no duplica lo existente y solo agrega
-- los dias que falten. No borra ni modifica datos reales.
-- Todos los registros usan RUC 999..., placas TST-... y el correo
-- prueba.datos@rutaec.test (cuenta sin acceso: no se puede iniciar sesion).
--
-- Uso (PowerShell, desde la raiz del repo; usuario y base estan en tu .env):
--   Get-Content database/scripts/datos_prueba_viajes.sql -Raw |
--     docker compose exec -T postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -v ON_ERROR_STOP=1
-- =============================================================================

SET search_path TO rutaec, public;

BEGIN;

DO $datos$
DECLARE
  zona CONSTANT text := 'America/Guayaquil';
  hoy  CONSTANT date := (clock_timestamp() AT TIME ZONE 'America/Guayaquil')::date;
  cfg  CONSTANT jsonb := $cfg$[
    {
      "ruc": "9990000000001",
      "razon": "Transportes Andes Prueba S.A.",
      "nombre": "Andes Express (prueba)",
      "c1": "#16324F", "c2": "#F2B705",
      "placa": "TST-0001", "unidad": "101",
      "chasis": "Hino", "carroceria": "Picosa",
      "hora": "07:00",
      "ruta": "Riobamba - Ambato - Quito (prueba)",
      "paradas": [
        {"ciudad": "Riobamba", "provincia": "Chimborazo", "min": 0},
        {"ciudad": "Ambato",   "provincia": "Tungurahua", "min": 60},
        {"ciudad": "Quito",    "provincia": "Pichincha",  "min": 210}
      ],
      "tarifas": [
        {"o": 1, "d": 2, "n": 2.00, "v": 2.50},
        {"o": 2, "d": 3, "n": 3.50, "v": 4.50},
        {"o": 1, "d": 3, "n": 5.00, "v": 6.50}
      ]
    },
    {
      "ruc": "9990000000002",
      "razon": "Cooperativa Santa Prueba",
      "nombre": "Santa Prueba",
      "c1": "#7A1F2B", "c2": "#FFFFFF",
      "placa": "TST-0002", "unidad": "202",
      "chasis": "Mercedes-Benz", "carroceria": "Busscar",
      "hora": "09:30",
      "ruta": "Ambato - Quito (prueba)",
      "paradas": [
        {"ciudad": "Ambato", "provincia": "Tungurahua", "min": 0},
        {"ciudad": "Quito",  "provincia": "Pichincha",  "min": 180}
      ],
      "tarifas": [
        {"o": 1, "d": 2, "n": 3.25, "v": 4.00}
      ]
    }
  ]$cfg$;
  letras CONSTANT text[] := ARRAY['A','B','C','D'];

  c jsonb;
  p jsonb;
  t jsonb;
  v_usuario uuid;
  v_coop uuid;
  v_grupo uuid;
  v_bus uuid;
  v_resolucion uuid;
  v_ruta uuid;
  v_frecuencia uuid;
  v_ciudad uuid;
  v_terminal uuid;
  v_hoja uuid;
  v_agenda uuid;
  v_viaje uuid;
  v_fecha date;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_ultimo_orden integer;
  v_ultimo_min integer;
  v_orden integer;
  v_dia integer;
  v_fila integer;
  v_col integer;
  v_nuevos integer := 0;
BEGIN
  -- Usuario ficticio que figura como creador de las hojas de ruta
  INSERT INTO usuarios(correo, nombres, apellidos, tipo_documento, numero_documento,
                       telefono, password_hash, correo_verificado_en)
  VALUES ('prueba.datos@rutaec.test', 'Datos', 'De Prueba', 'OTRO', 'PRUEBA-0001',
          '0000000000', '!sin-acceso', clock_timestamp())
  ON CONFLICT DO NOTHING;
  SELECT id INTO STRICT v_usuario FROM usuarios WHERE correo = 'prueba.datos@rutaec.test';

  FOR c IN SELECT value FROM jsonb_array_elements(cfg) LOOP
    -- Cooperativa
    INSERT INTO cooperativas(ruc, razon_social, nombre_comercial, color_primario,
                             color_secundario, correo, telefono, direccion)
    VALUES (c->>'ruc', c->>'razon', c->>'nombre', c->>'c1', c->>'c2',
            'contacto@' || (c->>'ruc') || '.rutaec.test', '0000000000', 'Direccion de prueba')
    ON CONFLICT DO NOTHING;
    SELECT id INTO STRICT v_coop FROM cooperativas WHERE ruc = c->>'ruc';

    -- Grupo de buses
    SELECT id INTO v_grupo FROM grupos_buses
     WHERE cooperativa_id = v_coop AND nombre = 'Larga distancia (prueba)';
    IF v_grupo IS NULL THEN
      INSERT INTO grupos_buses(cooperativa_id, nombre, tipo)
      VALUES (v_coop, 'Larga distancia (prueba)', 'LARGA_DISTANCIA')
      RETURNING id INTO v_grupo;
    END IF;

    -- Bus de 40 asientos en un piso (filas 1-3 VIP, resto NORMAL)
    INSERT INTO buses(cooperativa_id, grupo_id, placa, numero_unidad, color,
                      marca_chasis, marca_carroceria, anio, pisos, capacidad)
    VALUES (v_coop, v_grupo, c->>'placa', c->>'unidad', 'Blanco',
            c->>'chasis', c->>'carroceria', 2022, 1, 40)
    ON CONFLICT DO NOTHING;
    SELECT id INTO STRICT v_bus FROM buses WHERE placa = c->>'placa';

    FOR v_fila IN 1..10 LOOP
      FOR v_col IN 1..4 LOOP
        INSERT INTO asientos_bus(bus_id, numero, piso, fila, columna, categoria)
        VALUES (v_bus, v_fila || letras[v_col], 1, v_fila, v_col,
                CASE WHEN v_fila <= 3 THEN 'VIP' ELSE 'NORMAL' END)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;

    -- Resolucion que autoriza la frecuencia
    SELECT id INTO v_resolucion FROM resoluciones
     WHERE cooperativa_id = v_coop AND numero = 'RES-PRUEBA-001';
    IF v_resolucion IS NULL THEN
      INSERT INTO resoluciones(cooperativa_id, numero, autoridad, fecha_emision, vigente_desde)
      VALUES (v_coop, 'RES-PRUEBA-001', 'Autoridad de prueba', hoy - 400, hoy - 365)
      RETURNING id INTO v_resolucion;
    END IF;

    -- Ruta con sus paradas (ciudad + terminal)
    SELECT id INTO v_ruta FROM rutas
     WHERE cooperativa_id = v_coop AND nombre = c->>'ruta';
    IF v_ruta IS NULL THEN
      INSERT INTO rutas(cooperativa_id, nombre) VALUES (v_coop, c->>'ruta')
      RETURNING id INTO v_ruta;

      v_orden := 0;
      FOR p IN SELECT value FROM jsonb_array_elements(c->'paradas') LOOP
        v_orden := v_orden + 1;

        INSERT INTO ciudades(provincia, nombre)
        VALUES (p->>'provincia', p->>'ciudad')
        ON CONFLICT DO NOTHING;
        SELECT id INTO STRICT v_ciudad FROM ciudades
         WHERE pais = 'EC' AND provincia = p->>'provincia' AND nombre = p->>'ciudad';

        SELECT id INTO v_terminal FROM terminales
         WHERE ciudad_id = v_ciudad AND nombre = 'Terminal Terrestre de ' || (p->>'ciudad');
        IF v_terminal IS NULL THEN
          INSERT INTO terminales(ciudad_id, nombre, direccion)
          VALUES (v_ciudad, 'Terminal Terrestre de ' || (p->>'ciudad'), 'Direccion de prueba')
          RETURNING id INTO v_terminal;
        END IF;

        INSERT INTO paradas_ruta(ruta_id, orden, terminal_id, minutos_desde_origen)
        VALUES (v_ruta, v_orden, v_terminal, (p->>'min')::integer);
      END LOOP;
    END IF;

    SELECT max(orden) INTO v_ultimo_orden FROM paradas_ruta WHERE ruta_id = v_ruta;
    SELECT minutos_desde_origen INTO v_ultimo_min FROM paradas_ruta
     WHERE ruta_id = v_ruta AND orden = v_ultimo_orden;

    -- Frecuencia diaria
    SELECT id INTO v_frecuencia FROM frecuencias
     WHERE cooperativa_id = v_coop AND codigo = 'PRUEBA-' || (c->>'placa');
    IF v_frecuencia IS NULL THEN
      INSERT INTO frecuencias(cooperativa_id, codigo, ruta_id, resolucion_id, hora_salida)
      VALUES (v_coop, 'PRUEBA-' || (c->>'placa'), v_ruta, v_resolucion, (c->>'hora')::time)
      RETURNING id INTO v_frecuencia;
      FOR v_dia IN 1..7 LOOP
        INSERT INTO dias_frecuencia(frecuencia_id, dia_iso) VALUES (v_frecuencia, v_dia);
      END LOOP;
    END IF;

    -- Un viaje publicado por cada uno de los proximos 7 dias
    FOR v_dia IN 1..7 LOOP
      v_fecha  := hoy + v_dia;
      v_inicio := (v_fecha + (c->>'hora')::time) AT TIME ZONE zona;
      v_fin    := v_inicio + make_interval(mins => v_ultimo_min);

      IF EXISTS (SELECT 1 FROM agenda_bus WHERE bus_id = v_bus AND inicio = v_inicio) THEN
        CONTINUE;
      END IF;

      SELECT id INTO v_hoja FROM hojas_ruta
       WHERE cooperativa_id = v_coop AND grupo_id = v_grupo AND fecha = v_fecha;
      IF v_hoja IS NULL THEN
        INSERT INTO hojas_ruta(cooperativa_id, grupo_id, fecha, estado, creado_por)
        VALUES (v_coop, v_grupo, v_fecha, 'PUBLICADA', v_usuario)
        RETURNING id INTO v_hoja;
      END IF;

      INSERT INTO agenda_bus(cooperativa_id, bus_id, tipo, inicio, fin)
      VALUES (v_coop, v_bus, 'VIAJE', v_inicio, v_fin)
      RETURNING id INTO v_agenda;

      -- El snapshot (paradas, asientos, tarifas) solo se arma con el viaje en borrador
      INSERT INTO viajes(cooperativa_id, hoja_ruta_id, frecuencia_id, ruta_id, bus_id,
                         agenda_id, estado, cierre_ventas)
      VALUES (v_coop, v_hoja, v_frecuencia, v_ruta, v_bus, v_agenda, 'BORRADOR',
              v_inicio - interval '1 hour')
      RETURNING id INTO v_viaje;

      INSERT INTO paradas_viaje(viaje_id, orden, terminal_id, nombre_snapshot, llegada, salida)
      SELECT v_viaje, pr.orden, pr.terminal_id, te.nombre,
             CASE WHEN pr.orden = 1 THEN v_inicio
                  WHEN pr.orden = v_ultimo_orden THEN v_fin
                  ELSE v_inicio + make_interval(mins => pr.minutos_desde_origen) END,
             CASE WHEN pr.orden = 1 THEN v_inicio
                  WHEN pr.orden = v_ultimo_orden THEN v_fin
                  ELSE v_inicio + make_interval(mins => pr.minutos_desde_origen + 5) END
        FROM paradas_ruta pr
        JOIN terminales te ON te.id = pr.terminal_id
       WHERE pr.ruta_id = v_ruta;

      INSERT INTO asientos_viaje(viaje_id, numero, piso, fila, columna, categoria,
                                 accesible, preferencial)
      SELECT v_viaje, numero, piso, fila, columna, categoria, accesible, preferencial
        FROM asientos_bus
       WHERE bus_id = v_bus AND activo;

      FOR t IN SELECT value FROM jsonb_array_elements(c->'tarifas') LOOP
        INSERT INTO tarifas_viaje(viaje_id, origen_orden, destino_orden, categoria, importe,
                                  fuente_normativa, vigente_desde)
        VALUES (v_viaje, (t->>'o')::integer, (t->>'d')::integer, 'NORMAL',
                (t->>'n')::numeric, 'Tarifa de prueba (no oficial)', hoy - 30),
               (v_viaje, (t->>'o')::integer, (t->>'d')::integer, 'VIP',
                (t->>'v')::numeric, 'Tarifa de prueba (no oficial)', hoy - 30);
      END LOOP;

      UPDATE viajes SET estado = 'PUBLICADO' WHERE id = v_viaje;
      v_nuevos := v_nuevos + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Viajes de prueba publicados en esta ejecucion: %', v_nuevos;
END
$datos$;

COMMIT;

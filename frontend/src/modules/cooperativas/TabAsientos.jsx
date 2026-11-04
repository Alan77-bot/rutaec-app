import { useEffect, useMemo, useState } from "react";
import { busesService } from "./services/buses.service";
import ModalAsientos from "./ModalAsientos";

const TIPOS = {
  ESCALERA: { nombre: "Escalera", icono: "↕", color: "#e0e7ff" },
  BANO: { nombre: "Baño", icono: "WC", color: "#cffafe" },
  PUERTA: { nombre: "Puerta", icono: "⇥", color: "#fef3c7" },
  VACIO: { nombre: "Vacío", icono: "—", color: "#e2e8f0" },
};

const estilo = {
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
  },
  boton: {
    border: "1px solid var(--coop-primario, #16324F)",
    borderRadius: 10,
    background: "#fff",
    color: "var(--coop-primario, #16324F)",
    padding: "11px 15px",
    cursor: "pointer",
    fontWeight: 700,
    fontFamily: "inherit",
  },
  principal: {
    border: "1px solid var(--coop-primario, #16324F)",
    borderRadius: 10,
    background: "var(--coop-primario, #16324F)",
    color: "var(--coop-secundario, #FFFFFF)",
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 800,
    fontFamily: "inherit",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 11,
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#17243a",
    font: "inherit",
  },
};

const clave = (piso, fila, columna) => `${piso}-${fila}-${columna}`;

function configuracionInicial(pisos) {
  return Array.from({ length: pisos }, (_, i) => ({
    piso: i + 1,
    filas: 12,
    columnas: 5,
    pasillo: 3,
    espacios: [],
  }));
}

function inferirConfiguracion(pisos, asientos) {
  return configuracionInicial(pisos).map((config) => {
    const lista = asientos.filter((a) => Number(a.piso) === config.piso);
    if (!lista.length) return config;

    const filas = Math.max(1, ...lista.map((a) => Number(a.fila)));
    const columnas = Math.max(3, ...lista.map((a) => Number(a.columna)));
    const ocupadas = new Set(lista.map((a) => Number(a.columna)));
    let pasillo = 3;

    for (let columna = 2; columna < columnas; columna++) {
      if (!ocupadas.has(columna)) {
        pasillo = columna;
        break;
      }
    }

    return { ...config, filas, columnas, pasillo };
  });
}

function generarAsientos(capacidad, configuraciones) {
  const resultado = [];
  let numero = 1;

  for (const config of configuraciones) {
    const especiales = new Set(
      config.espacios.map((e) => clave(config.piso, e.fila, e.columna))
    );

    for (let fila = 1; fila <= config.filas; fila++) {
      for (let columna = 1; columna <= config.columnas; columna++) {
        if (columna === config.pasillo) continue;
        if (especiales.has(clave(config.piso, fila, columna))) continue;
        if (numero > capacidad) return resultado;

        resultado.push({
          numero: String(numero++),
          piso: config.piso,
          fila,
          columna,
          categoria: "NORMAL",
          preferencial: false,
          accesible: false,
          activo: true,
        });
      }
    }
  }

  return resultado;
}

function capacidadDelPlano(configuraciones) {
  return configuraciones.reduce((total, config) => {
    const especiales = config.espacios.filter(
      (e) => e.columna !== config.pasillo
    ).length;

    return total + config.filas * (config.columnas - 1) - especiales;
  }, 0);
}

export default function TabAsientos({ cooperativaId }) {
  const [buses, setBuses] = useState([]);
  const [busId, setBusId] = useState("");
  const [asientos, setAsientos] = useState([]);
  const [configuraciones, setConfiguraciones] = useState(
    configuracionInicial(1)
  );
  const [pisoActivo, setPisoActivo] = useState(1);
  const [modal, setModal] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [busPendiente, setBusPendiente] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const bus = useMemo(
    () => buses.find((b) => String(b.id) === String(busId)),
    [buses, busId]
  );

  const pisos = Math.max(1, Number(bus?.pisos) || 1);
  const capacidad = Number(bus?.capacidad) || 0;
  const config = configuraciones.find((c) => c.piso === pisoActivo);
  const activos = asientos.filter((a) => a.activo).length;
  const disponibles = capacidadDelPlano(configuraciones);
  const validacionPlano = useMemo(() => {
    const problemas = [];
    const resumenPisos = configuraciones.map((c) => {
      const lista = asientos.filter(
        (a) => Number(a.piso) === c.piso
      );

      const posiciones = new Set();
      let conflictos = 0;

      for (const a of lista) {
        const fila = Number(a.fila);
        const columna = Number(a.columna);
        const posicion = `${fila}-${columna}`;

        const fueraDePlano =
          !Number.isInteger(fila) ||
          !Number.isInteger(columna) ||
          fila < 1 ||
          columna < 1 ||
          fila > c.filas ||
          columna > c.columnas;

        const enPasillo = columna === c.pasillo;

        const enEspecial = c.espacios.some(
          (e) => e.fila === fila && e.columna === columna
        );

        if (
          fueraDePlano ||
          enPasillo ||
          enEspecial ||
          posiciones.has(posicion)
        ) {
          conflictos++;
        }

        posiciones.add(posicion);
      }

      const espaciosUtilizables =
        c.filas * (c.columnas - 1) -
        c.espacios.filter(
          (e) => e.columna !== c.pasillo
        ).length;

      if (conflictos > 0) {
        problemas.push(
          `Piso ${c.piso}: ${conflictos} asiento(s) con posiciones inválidas.`
        );
      }

      return {
        piso: c.piso,
        asientos: lista.length,
        espaciosUtilizables,
        conflictos,
      };
    });

    if (asientos.length !== capacidad) {
      problemas.push(
        `El bus requiere ${capacidad} asientos y actualmente tiene ${asientos.length}.`
      );
    }

    if (asientos.filter((a) => a.activo).length !== capacidad) {
      problemas.push(
        `La cantidad de asientos activos no coincide con la capacidad del bus.`
      );
    }

    const numeros = asientos.map(
      (a) => String(a.numero).trim().toUpperCase()
    );

    if (new Set(numeros).size !== numeros.length) {
      problemas.push("Hay números de asiento duplicados.");
    }

    const pisosValidos = new Set(
      configuraciones.map((c) => c.piso)
    );

    if (asientos.some(
      (a) => !pisosValidos.has(Number(a.piso))
    )) {
      problemas.push("Hay asientos asignados a pisos inexistentes.");
    }

    if (capacidadDelPlano(configuraciones) < capacidad) {
      problemas.push(
        "Las dimensiones actuales no tienen suficientes posiciones para la capacidad del bus."
      );
    }

    return {
      valido: problemas.length === 0,
      problemas,
      resumenPisos,
    };
  }, [asientos, configuraciones, capacidad]);
  const especialesTotal = configuraciones.reduce(
    (n, c) => n + c.espacios.length,
    0
  );

  const conflictosVisuales = useMemo(() => {
    const resultado = new Map();
    const ubicaciones = new Map();

    for (const asiento of asientos) {
      const piso = Number(asiento.piso);
      const fila = Number(asiento.fila);
      const columna = Number(asiento.columna);
      const configuracion = configuraciones.find(
        (c) => c.piso === piso
      );

      const motivos = [];

      if (!configuracion) {
        motivos.push("El piso no existe en la configuración.");
      } else {
        if (
          !Number.isInteger(fila) ||
          !Number.isInteger(columna) ||
          fila < 1 ||
          columna < 1 ||
          fila > configuracion.filas ||
          columna > configuracion.columnas
        ) {
          motivos.push("El asiento está fuera del plano.");
        }

        if (columna === configuracion.pasillo) {
          motivos.push("El asiento ocupa el pasillo.");
        }

        if (configuracion.espacios.some(
          (e) => e.fila === fila && e.columna === columna
        )) {
          motivos.push("El asiento coincide con un espacio especial.");
        }
      }

      const ubicacion = `${piso}-${fila}-${columna}`;
      const anteriores = ubicaciones.get(ubicacion) || [];
      anteriores.push(asiento);
      ubicaciones.set(ubicacion, anteriores);

      resultado.set(asiento, motivos);
    }

    for (const grupo of ubicaciones.values()) {
      if (grupo.length <= 1) continue;

      for (const asiento of grupo) {
        resultado.get(asiento).push(
          "Hay varios asientos en la misma posición."
        );
      }
    }

    return resultado;
  }, [asientos, configuraciones]);

  const asientosNoVisibles = asientos.filter((asiento) => {
    if (Number(asiento.piso) !== pisoActivo || !config) {
      return false;
    }

    const fila = Number(asiento.fila);
    const columna = Number(asiento.columna);

    return (
      !Number.isInteger(fila) ||
      !Number.isInteger(columna) ||
      fila < 1 ||
      columna < 1 ||
      fila > config.filas ||
      columna > config.columnas
    );
  });
  const posiciones = useMemo(
    () => new Map(
      asientos
        .filter((a) => Number(a.piso) === pisoActivo)
        .map((a) => [clave(a.piso, a.fila, a.columna), a])
    ),
    [asientos, pisoActivo]
  );

  const especiales = useMemo(
    () => new Map(
      (config?.espacios || []).map((e) => [
        clave(pisoActivo, e.fila, e.columna),
        e,
      ])
    ),
    [config, pisoActivo]
  );

  useEffect(() => {
    let vigente = true;

    busesService.listar()
      .then((datos) => {
        if (!vigente) return;
        setBuses(Array.isArray(datos) ? datos : datos?.buses || []);
      })
      .catch((e) => {
        if (vigente) setError(e.message);
      });

    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!busId) return;

    let vigente = true;
    setCargando(true);
    setError("");
    setMensaje("");
    setAsientos([]);

    busesService.consultarAsientos(busId, cooperativaId)
      .then((datos) => {
        if (!vigente) return;
        const lista = datos?.asientos || [];
        setAsientos(lista);
        setConfiguraciones(inferirConfiguracion(
          Math.max(1, Number(datos?.pisos) || 1),
          lista
        ));
        setPisoActivo(1);
        setCambios(false);
      })
      .catch((e) => {
        if (vigente) setError(e.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => { vigente = false; };
  }, [busId, cooperativaId]);

  useEffect(() => {
    const advertir = (e) => {
      if (!cambios) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", advertir);
    return () => window.removeEventListener("beforeunload", advertir);
  }, [cambios]);

  function cambiarConfiguracion(campo, valor) {
    if (!config) return;

    setConfiguraciones((actual) => actual.map((c) => {
      if (c.piso !== pisoActivo) return c;

      const nuevo = { ...c, [campo]: valor };

      if (campo === "columnas") {
        nuevo.pasillo = Math.min(nuevo.pasillo, valor);
      }

      nuevo.espacios = nuevo.espacios.filter(
        (e) => e.fila <= nuevo.filas &&
               e.columna <= nuevo.columnas &&
               e.columna !== nuevo.pasillo
      );

      return nuevo;
    }));

    setCambios(true);
    setMensaje("");
  }

  async function descartarCambios() {
  if (!busId || cargando || guardando) return;

  setModal(null);
  setCargando(true);
  setError("");
  setMensaje("");

  try {
    const datos = await busesService.consultarAsientos(
      busId,
      cooperativaId
    );

    const lista = datos?.asientos || [];

    setAsientos(lista);
    setConfiguraciones(
      inferirConfiguracion(pisos, lista)
    );
    setPisoActivo(1);
    setCambios(false);

    setMensaje(
      "Se restauró la última distribución guardada."
    );
  } catch (e) {
    setError(e.message);
  } finally {
    setCargando(false);
  }
}




  function elegirBus(id) {
    if (String(id) === String(busId)) {
      setModal(null);
      return;
    }

    if (cambios) {
      setBusPendiente(String(id));
      setModal("confirmarBus");
    } else {
      setBusId(String(id));
      setModal(null);
    }
  }

  function abrirCelda(fila, columna) {
    const asiento = posiciones.get(clave(pisoActivo, fila, columna));

    if (asiento) {
      setSeleccion({ ...asiento, clase: "asiento" });
      setModal("asiento");
      return;
    }

    if (columna === config.pasillo) return;

    const especial = especiales.get(clave(pisoActivo, fila, columna));

    setSeleccion({
      clase: "espacio",
      piso: pisoActivo,
      fila,
      columna,
      tipo: especial?.tipo || "",
    });
    setModal("espacio");
  }

  function aplicarAsiento() {
    if (!seleccion) return;

    setAsientos((actual) => actual.map((a) =>
      String(a.numero) === String(seleccion.numero)
        ? {
            ...a,
            categoria: seleccion.categoria,
            preferencial: seleccion.preferencial,
            accesible: seleccion.accesible,
            activo: seleccion.activo,
          }
        : a
    ));

    setCambios(true);
    setModal(null);
  }

  function aplicarEspacio() {
    if (!seleccion) return;

    setConfiguraciones((actual) => actual.map((c) => {
      if (c.piso !== seleccion.piso) return c;

      const restantes = c.espacios.filter(
        (e) => !(e.fila === seleccion.fila &&
                 e.columna === seleccion.columna)
      );

      if (seleccion.tipo) {
        restantes.push({
          fila: seleccion.fila,
          columna: seleccion.columna,
          tipo: seleccion.tipo,
        });
      }

      return { ...c, espacios: restantes };
    }));

    setCambios(true);
    setMensaje("");
    setModal(null);
  }

  function solicitarGeneracion() {
    if (disponibles < capacidad) {
      setError(
        `El plano permite ${disponibles} asientos, pero el bus requiere ${capacidad}.`
      );
      return;
    }

    setError("");

    if (asientos.length) {
      setModal("regenerar");
    } else {
      ejecutarGeneracion();
    }
  }

  function ejecutarGeneracion() {
    setAsientos(generarAsientos(capacidad, configuraciones));
    setCambios(true);
    setMensaje("Plano generado. Revisa los asientos antes de guardar.");
    setModal(null);
  }

  async function guardar() {
    if (!bus || !asientos.length) return;

    if (!validacionPlano.valido) {
      setError(
        "Corrige los problemas de distribución antes de guardar."
      );
      setModal(null);
      return;
    }

    if (asientos.length !== capacidad || activos !== capacidad) {
      setError(
        `Se requieren exactamente ${capacidad} asientos activos.`
      );
      setModal(null);
      return;
    }

    for (const asiento of asientos) {
      const c = configuraciones.find((p) => p.piso === Number(asiento.piso));

      if (
        !c ||
        asiento.fila > c.filas ||
        asiento.columna > c.columnas ||
        asiento.columna === c.pasillo ||
        c.espacios.some((e) =>
          e.fila === asiento.fila && e.columna === asiento.columna
        )
      ) {
        setError(
          "La configuración ya no coincide con los asientos. Regenera el plano antes de guardar."
        );
        setModal(null);
        return;
      }
    }

    setGuardando(true);
    setError("");
    setModal(null);

    try {
      const datos = await busesService.guardarAsientos(
        busId,
        asientos,
        cooperativaId
      );

      setAsientos(datos?.asientos || asientos);
      setCambios(false);
      setMensaje(
        "Asientos guardados. Los espacios especiales son temporales y no se almacenan."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const busesFiltrados = buses.filter((b) =>
    `${b.numero_unidad} ${b.placa}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  return (
    <section className="asientos-editor" style={{
      maxWidth: 1200,
      margin: "0 auto",
      padding: "24px 12px 60px",
      color: "#17243a",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 15,
        marginBottom: 22,
      }}>
        <div>
          <small style={{ color: "var(--coop-primario, #16324F)", fontWeight: 800 }}>
            GESTIÓN DE FLOTA
          </small>
          <h2 style={{ fontSize: 28, margin: "7px 0" }}>
            Distribución de asientos
          </h2>
          <p style={{ color: "#64748b", margin: 0 }}>
            Diseña cada piso de manera independiente.
          </p>
        </div>

        {cambios && (
          <strong style={{
            color: "#9a5a16",
            background: "#fff3e5",
            padding: 12,
            borderRadius: 12,
          }}>
            ● Cambios sin guardar
          </strong>
        )}
      </header>

      {error && (
        <div role="alert" style={{
          ...estilo.panel,
          background: "#fff1f2",
          color: "#9f1239",
        }}>
          {error}
        </div>
      )}

      {mensaje && (
        <div role="status" style={{
          ...estilo.panel,
          background: "#f0fdf4",
          color: "#166534",
        }}>
          {mensaje}
        </div>
      )}

      <div style={estilo.panel}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>
              {bus ? `Unidad ${bus.numero_unidad}` : "Selecciona un bus"}
            </h3>
            <small style={{ color: "#64748b" }}>
              {bus
                ? `${bus.placa} · ${capacidad} pasajeros · ${pisos} piso(s)`
                : `${buses.length} unidades disponibles`}
            </small>
          </div>

          <button
            type="button"
            style={estilo.principal}
            onClick={() => {
              setBusqueda("");
              setModal("buses");
            }}
          >
            {bus ? "Cambiar unidad" : "Elegir bus"}
          </button>
        </div>
      </div>

      {bus && !cargando && config && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}>
            {[
              ["Capacidad", capacidad],
              ["Asientos activos", activos],
              ["Pisos", pisos],
              ["Espacios especiales", especialesTotal],
            ].map(([titulo, valor]) => (
              <div key={titulo} style={estilo.panel}>
                <small style={{ color: "#64748b" }}>{titulo}</small>
                <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>
                  {valor}
                </div>
              </div>
            ))}
          </div>

          <div style={estilo.panel}>
            <div style={{
              marginBottom: 22,
              padding: 16,
              borderRadius: 12,
              border: validacionPlano.valido
                ? "1px solid #86efac"
                : "1px solid #fcd34d",
              background: validacionPlano.valido
                ? "#f0fdf4"
                : "#fffbeb",
            }}>
              <strong style={{
                color: validacionPlano.valido
                  ? "#166534"
                  : "#92400e",
              }}>
                {validacionPlano.valido
                  ? "✓ Distribución válida"
                  : "⚠ La distribución necesita revisión"}
              </strong>

              {!validacionPlano.valido && (
                <ul style={{
                  marginBottom: 0,
                  paddingLeft: 20,
                  color: "#92400e",
                }}>
                  {validacionPlano.problemas.map((problema, i) => (
                    <li key={i}>{problema}</li>
                  ))}
                </ul>
              )}

              <div style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
                marginTop: 15,
              }}>
                {validacionPlano.resumenPisos.map((p) => (
                  <div key={p.piso} style={{
                    padding: 12,
                    background: "#fff",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                  }}>
                    <strong>Piso {p.piso}</strong>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      Asientos: {p.asientos}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Posiciones disponibles: {p.espaciosUtilizables}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: p.conflictos ? "#b91c1c" : "#166534",
                    }}>
                      Conflictos: {p.conflictos}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <h3 style={{ marginTop: 0 }}>Configuración por piso</h3>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}>
              {configuraciones.map((c) => (
                <button
                  type="button"
                  key={c.piso}
                  onClick={() => setPisoActivo(c.piso)}
                  style={{
                    ...estilo.boton,
                    background: pisoActivo === c.piso ? "var(--coop-primario, #16324F)" : "#fff",
                    color: pisoActivo === c.piso ? "var(--coop-secundario, #FFFFFF)" : "var(--coop-primario, #16324F)",
                    borderColor: "var(--coop-primario, #16324F)",
                  }}
                >
                  Piso {c.piso} · {asientos.filter((a) => Number(a.piso) === c.piso).length} asientos
                  {validacionPlano.resumenPisos.find(
                    (p) => p.piso === c.piso
                  )?.conflictos > 0 ? " · ⚠ Conflictos" : ""}
                </button>
              ))}
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 15,
            }}>
              <label>
                <span>Filas</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.filas}
                  onChange={(e) => cambiarConfiguracion(
                    "filas",
                    Math.max(1, Math.min(100, Number(e.target.value) || 1))
                  )}
                  style={estilo.input}
                />
              </label>

              <label>
                <span>Columnas</span>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={config.columnas}
                  onChange={(e) => cambiarConfiguracion(
                    "columnas",
                    Math.max(3, Math.min(20, Number(e.target.value) || 3))
                  )}
                  style={estilo.input}
                />
              </label>

              <label>
                <span>Columna del pasillo</span>
                <select
                  value={config.pasillo}
                  onChange={(e) => cambiarConfiguracion(
                    "pasillo",
                    Number(e.target.value)
                  )}
                  style={estilo.input}
                >
                  {Array.from(
                    { length: config.columnas },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>
                      Columna {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid #e2e8f0",
            }}>
              <div>
                <strong>{disponibles}</strong> posiciones disponibles
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Capacidad requerida: {capacidad}
                </div>
              </div>

              <button
                type="button"
                style={estilo.principal}
                onClick={solicitarGeneracion}
              >
                Generar plano
              </button>
            </div>
          </div>

          <div style={estilo.panel}>
            <h3 style={{ marginTop: 0 }}>Plano interactivo · Piso {pisoActivo}</h3>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              Pulsa un asiento para editarlo o una celda libre para
              agregar un espacio especial.
            </p>

            {asientosNoVisibles.length > 0 && (
              <div
                role="alert"
                style={{
                  padding: 15,
                  marginBottom: 16,
                  background: "#fff1f2",
                  border: "1px solid #fda4af",
                  borderRadius: 12,
                  color: "#9f1239",
                }}
              >
                <strong>
                  Asientos fuera del plano: {asientosNoVisibles.length}
                </strong>
                <p style={{ fontSize: 13, marginBottom: 8 }}>
                  Estos asientos no se muestran en la cuadrícula porque
                  sus coordenadas superan las dimensiones del piso.
                  Ajusta las dimensiones o regenera la distribución.
                </p>
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}>
                  {asientosNoVisibles.map((asiento, indice) => (
                    <span
                      key={`${asiento.numero}-${indice}`}
                      style={{
                        padding: "5px 9px",
                        background: "#fff",
                        border: "1px solid #fecdd3",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      Asiento {asiento.numero}
                      {" · F"}{asiento.fila}
                      {" · C"}{asiento.columna}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ overflowX: "auto", padding: "15px 0" }}>
              <div style={{
                width: "max-content",
                margin: "0 auto",
                padding: "25px 24px",
                background: "#f8fafc",
                border: "2px solid #dbe4ee",
                borderRadius: "45px 45px 20px 20px",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#64748b",
                  fontSize: 12,
                  marginBottom: 22,
                }}>
                  <span>Conductor</span>
                  <strong>↑ FRENTE</strong>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${config.columnas}, 48px)`,
                  gap: 8,
                }}>
                  {Array.from(
                    { length: config.filas * config.columnas },
                    (_, indice) => {
                      const fila = Math.floor(indice / config.columnas) + 1;
                      const columna = indice % config.columnas + 1;
                      const llave = clave(pisoActivo, fila, columna);
                      const asiento = posiciones.get(llave);
                      const especial = especiales.get(llave);

                      if (asiento) {
                        const motivos = conflictosVisuales.get(asiento) || [];
                        const tieneConflicto = motivos.length > 0;

                        const fondo = !asiento.activo
                          ? "#e5e7eb"
                          : asiento.accesible
                          ? "#dbeafe"
                          : asiento.preferencial
                          ? "#fef3c7"
                          : "#dcfce7";

                        return (
                          <button
                            key={llave}
                            type="button"
                            title={tieneConflicto ? `Asiento ${asiento.numero}: ${motivos.join(" ")}` : `Editar asiento ${asiento.numero}`}
                            onClick={() => abrirCelda(fila, columna)}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 10,
                              border: tieneConflicto ? "2px solid #dc2626" : "1px solid #b6c5d5",
                              background: tieneConflicto ? "#fee2e2" : fondo,
                              color: "#17243a",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            {asiento.numero}
                          </button>
                        );
                      }

                      if (columna === config.pasillo) {
                        return <div key={llave} style={{ width: 48, height: 48 }} />;
                      }

                      return (
                        <button
                          key={llave}
                          type="button"
                          title={especial
                            ? TIPOS[especial.tipo]?.nombre
                            : "Agregar espacio especial"}
                          onClick={() => abrirCelda(fila, columna)}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            border: "1px dashed #cbd5e1",
                            background: especial
                              ? TIPOS[especial.tipo]?.color
                              : "#fff",
                            color: "#334155",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {especial
                            ? TIPOS[especial.tipo]?.icono
                            : "+"}
                        </button>
                      );
                    }
                  )}
                </div>

                <div style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 11,
                  marginTop: 24,
                }}>
                  PARTE TRASERA
                </div>
              </div>
            </div>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 15,
              fontSize: 12,
              color: "#64748b",
            }}>
              <span>🟥 Conflicto</span>
              <span>🟩 Normal</span>
              <span>🟨 Preferencial</span>
              <span>🟦 Accesible</span>
              <span>WC Baño</span>
              <span>↕ Escalera</span>
              <span>⇥ Puerta</span>
              <span>— Vacío</span>
            </div>
          </div>

          <div style={{
            ...estilo.panel,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 15,
          }}>
            <div>
              <strong>
                {cambios ? "Cambios pendientes" : "Estado de la distribución"}
              </strong>
              <p style={{ color: "#64748b", fontSize: 13 }}>
                {activos} asientos activos de {capacidad} requeridos.
              </p>
            </div>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
            }}>
              <button
                type="button"
                style={{
                  ...estilo.boton,
                  opacity: !cambios || cargando || guardando ? 0.5 : 1,
                }}
                disabled={!cambios || cargando || guardando}
                onClick={() => setModal("descartar")}
              >
                Descartar cambios
              </button>
              <button
                type="button"
                style={{
                  ...estilo.principal,
                  opacity:
                    !cambios ||
                    cargando ||
                    guardando ||
                    activos !== capacidad ||
                    asientos.length !== capacidad
                      ? 0.5
                      : 1,
                }}
                disabled={
                  !cambios ||
                  cargando ||
                  guardando ||
                  asientos.length !== capacidad ||
                  activos !== capacidad
                }
                onClick={() => {
                  if (!validacionPlano.valido) {
                    setError("La distribución tiene conflictos pendientes.");
                    return;
                  }
                  setModal("guardar");
                }}
              >
                {guardando ? "Guardando..." : "Guardar distribución"}
              </button>
            </div>
            </div>
        </>
      )}

      {cargando && <div style={estilo.panel}>Cargando distribución...</div>}

      {modal === "buses" && (
        <ModalAsientos
          titulo="Seleccionar unidad"
          descripcion="Busca por placa o número de unidad."
          onClose={() => setModal(null)}
        >
          <input
            type="search"
            placeholder="Buscar bus..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ ...estilo.input, marginBottom: 16 }}
          />

          <div style={{ display: "grid", gap: 9 }}>
            {busesFiltrados.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => elegirBus(b.id)}
                style={{ ...estilo.boton, textAlign: "left" }}
              >
                <strong>Unidad {b.numero_unidad}</strong>
                <div style={{ color: "#64748b", marginTop: 5 }}>
                  {b.placa} · {b.capacidad} pasajeros · {b.pisos} piso(s)
                </div>
              </button>
            ))}
            {!busesFiltrados.length && <p>No se encontraron buses.</p>}
          </div>
        </ModalAsientos>
      )}

      {modal === "confirmarBus" && (
        <ModalAsientos
          titulo="¿Cambiar de unidad?"
          descripcion="Hay cambios sin guardar."
          onClose={() => setModal("buses")}
          acciones={
            <>
              <button style={estilo.boton} onClick={() => setModal("buses")}>
                Cancelar
              </button>
              <button
                style={estilo.principal}
                onClick={() => {
                  setBusId(busPendiente);
                  setCambios(false);
                  setModal(null);
                }}
              >
                Descartar y continuar
              </button>
            </>
          }
        >
          Perderás las modificaciones que no hayas guardado.
        </ModalAsientos>
      )}

      {modal === "regenerar" && (
        <ModalAsientos
          titulo="¿Regenerar distribución?"
          descripcion="Se reemplazará el plano actual."
          onClose={() => setModal(null)}
          acciones={
            <>
              <button style={estilo.boton} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button style={estilo.principal} onClick={ejecutarGeneracion}>
                Sí, regenerar
              </button>
            </>
          }
        >
          Se generarán {capacidad} asientos respetando las configuraciones
          de los pisos y los espacios especiales.
        </ModalAsientos>
      )}

      {modal === "espacio" && seleccion && (
        <ModalAsientos
          titulo="Configurar espacio"
          descripcion={`Piso ${seleccion.piso} · Fila ${seleccion.fila} · Columna ${seleccion.columna}`}
          onClose={() => setModal(null)}
          acciones={
            <>
              <button style={estilo.boton} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button style={estilo.principal} onClick={aplicarEspacio}>
                Aplicar
              </button>
            </>
          }
        >
          <label>
            Tipo de espacio
            <select
              value={seleccion.tipo}
              onChange={(e) => setSeleccion((s) => ({
                ...s,
                tipo: e.target.value,
              }))}
              style={{ ...estilo.input, marginTop: 9 }}
            >
              <option value="">Celda libre</option>
              {Object.entries(TIPOS).map(([valor, tipo]) => (
                <option key={valor} value={valor}>{tipo.nombre}</option>
              ))}
            </select>
          </label>
          <p style={{ color: "#64748b", fontSize: 13 }}>
            Este espacio se conservará durante la edición, pero no
            se guardará en PostgreSQL.
          </p>
        </ModalAsientos>
      )}

      {modal === "asiento" && seleccion && (
        <ModalAsientos
          titulo={`Editar asiento ${seleccion.numero}`}
          descripcion={`Piso ${seleccion.piso} · Fila ${seleccion.fila} · Columna ${seleccion.columna}`}
          onClose={() => setModal(null)}
          acciones={
            <>
              <button style={estilo.boton} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button style={estilo.principal} onClick={aplicarAsiento}>
                Aplicar cambios
              </button>
            </>
          }
        >
          <label>Categoría<select style={estilo.input} value={seleccion.categoria} onChange={e => setSeleccion(s => ({ ...s, categoria: e.target.value }))}><option value="NORMAL">Normal</option><option value="VIP">VIP</option></select></label>
          {[
            ["preferencial", "Preferencial"],
            ["accesible", "Accesible"],
            ["activo", "Activo"],
          ].map(([campo, titulo]) => (
            <label key={campo} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: "1px solid #e2e8f0",
            }}>
              <strong>{titulo}</strong>
              <input
                type="checkbox"
                checked={Boolean(seleccion[campo])}
                onChange={(e) => setSeleccion((s) => ({
                  ...s,
                  [campo]: e.target.checked,
                }))}
              />
            </label>
          ))}
        </ModalAsientos>
      )}

      {modal === "descartar" && (
  <ModalAsientos
    titulo="¿Descartar los cambios?"
    descripcion="Se recuperará la última distribución guardada."
    onClose={() => setModal(null)}
    acciones={
      <>
        <button
          type="button"
          style={estilo.boton}
          onClick={() => setModal(null)}
        >
          Cancelar
        </button>

        <button
          type="button"
          style={estilo.principal}
          onClick={descartarCambios}
        >
          Descartar y restaurar
        </button>
      </>
    }
  >
    <p>
      Perderás las modificaciones que todavía no hayas
      guardado, incluyendo los espacios especiales temporales.
    </p>
  </ModalAsientos>
)}

      {modal === "guardar" && (
        <ModalAsientos
          titulo="Confirmar guardado"
          descripcion="Se guardarán únicamente los asientos."
          onClose={() => setModal(null)}
          acciones={
            <>
              <button style={estilo.boton} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button style={estilo.principal} onClick={guardar}>
                Confirmar y guardar
              </button>
            </>
          }
        >
          <p>Unidad: <strong>{bus?.numero_unidad}</strong></p>
          <p>Capacidad: <strong>{capacidad}</strong></p>
          <p>Asientos activos: <strong>{activos}</strong></p>
          <p>Espacios especiales temporales: <strong>{especialesTotal}</strong></p>
          <p style={{ color: "#9a5a16" }}>
            Los espacios especiales y las dimensiones del editor no
            se almacenarán en la base de datos.
          </p>
        </ModalAsientos>
      )}
    </section>
  );
}
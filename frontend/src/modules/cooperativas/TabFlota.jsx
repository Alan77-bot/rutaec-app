import Dialogo from '../../components/ui/Dialogo'

import { useEffect, useState } from "react";
import { busesService } from "./services/buses.service";

const FORM_INICIAL = {
  grupoId: "",
  placa: "",
  numeroUnidad: "",
  color: "",
  marcaChasis: "",
  marcaCarroceria: "",
  anio: "",
  pisos: "1",
  capacidad: "",
  imagenUrl: "",
  comodidades: [],
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(10, 24, 43, 0.68)",
  backdropFilter: "blur(5px)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 2000,
};

const modalStyle = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 25px 80px rgba(0,0,0,.25)",
  color: "#263445",
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: "#526171",
  marginBottom: 6,
};

const valorStyle = {
  fontSize: 15,
  fontWeight: 600,
  color: "#1b304b",
  overflowWrap: "anywhere",
};

function EtiquetaEstado({ estado }) {
  const estilos = {
    ACTIVO: {
      fondo: "#dcfce7",
      texto: "#15803d",
      punto: "#16a34a",
    },
    INACTIVO: {
      fondo: "#fee2e2",
      texto: "#b91c1c",
      punto: "#dc2626",
    },
    MANTENIMIENTO: {
      fondo: "#fef3c7",
      texto: "#92400e",
      punto: "#f59e0b",
    },
  };

  const estilo = estilos[estado] ?? {
    fondo: "#f1f5f9",
    texto: "#475569",
    punto: "#64748b",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 13px",
        borderRadius: 30,
        fontSize: 12,
        fontWeight: 800,
        background: estilo.fondo,
        color: estilo.texto,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: estilo.punto,
        }}
      />
      {estado || "SIN ESTADO"}
    </span>
  );
}

function DatoBus({ etiqueta, valor }) {
  return (
    <div
      style={{
        padding: "13px 15px",
        borderRadius: 12,
        background: "#f7f9fc",
        border: "1px solid #e9edf3",
        minWidth: 0,
      }}
    >
      <div style={labelStyle}>{etiqueta}</div>
      <div style={valorStyle}>
        {valor !== null && valor !== undefined && valor !== ""
          ? valor
          : "No registrado"}
      </div>
    </div>
  );
}

export default function TabFlota({ onTotalBusesChange }) {
  const [buses, setBuses] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [comodidadesDisponibles, setComodidadesDisponibles] =
  useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [errorFormulario, setErrorFormulario] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado] =
  useState("ACTIVO");
  const [form, setForm] = useState({ ...FORM_INICIAL });
  const [busEditando, setBusEditando] = useState(null);

  const [busDetalle, setBusDetalle] = useState(null);
  const [busConfirmandoEstado, setBusConfirmandoEstado] =
    useState(null);

  const [busCambiandoEstado, setBusCambiandoEstado] =
    useState(null);

  const [errorEstado, setErrorEstado] = useState("");
  const [mensajeEstado, setMensajeEstado] = useState("");

  async function cargarDatos() {
    const [listaBuses, listaGrupos] = await Promise.all([
      busesService.listar(),
      busesService.listarGrupos(),
    ]);

    setBuses(listaBuses);
    setGrupos(listaGrupos);
    onTotalBusesChange?.(listaBuses.length);
  }

  useEffect(() => {
    let activo = true;

    Promise.all([
  busesService.listar(),
  busesService.listarGrupos(),
  busesService.listarComodidades(),
])
  .then(([listaBuses, listaGrupos, listaComodidades]) => {
    if (!activo) return;

    setBuses(listaBuses);
    setGrupos(listaGrupos);
    setComodidadesDisponibles(listaComodidades);
    onTotalBusesChange?.(listaBuses.length);
  })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  function actualizar(campo, valor) {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function abrirRegistro() {
    setBusEditando(null);
    setForm({ ...FORM_INICIAL });
    setErrorFormulario("");
    setMostrarFormulario(true);
  }

  function abrirEdicion(bus) {
    setBusEditando(bus.id);

    setForm({
      grupoId: bus.grupo_id ?? "",
      placa: bus.placa ?? "",
      numeroUnidad: bus.numero_unidad ?? "",
      color: bus.color ?? "",
      marcaChasis: bus.marca_chasis ?? "",
      marcaCarroceria: bus.marca_carroceria ?? "",
      anio: bus.anio == null ? "" : String(bus.anio),
      pisos: String(bus.pisos ?? 1),
      capacidad: String(bus.capacidad ?? ""),
      imagenUrl: bus.imagen_url ?? "",
      comodidades:
  bus.bus_comodidades?.map((item) => item.comodidad) ?? [],
    });

    setErrorFormulario("");
    setBusDetalle(null);
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    if (guardando) return;

    setMostrarFormulario(false);
    setBusEditando(null);
    setForm({ ...FORM_INICIAL });
    setErrorFormulario("");
  }

  async function guardarBus(e) {
    e.preventDefault();

    if (guardando) return;

    setGuardando(true);
    setErrorFormulario("");

    const datos = {
      grupoId: form.grupoId,
      placa: form.placa.trim().toUpperCase(),
      numeroUnidad: form.numeroUnidad.trim(),
      color: form.color.trim(),
      marcaChasis: form.marcaChasis.trim(),
      marcaCarroceria: form.marcaCarroceria.trim(),
      anio: form.anio ? Number(form.anio) : null,
      pisos: Number(form.pisos),
      capacidad: Number(form.capacidad),
      imagenUrl: form.imagenUrl.trim() || null,
      comodidades: form.comodidades,
    };

    try {
      if (busEditando) {
        await busesService.editar(busEditando, datos);
      } else {
        await busesService.registrar(datos);
      }

      setMostrarFormulario(false);
      setBusEditando(null);
      setForm({ ...FORM_INICIAL });

      try {
        await cargarDatos();
        setError("");
      } catch {
        setError(
          "Bus guardado, pero no se pudo actualizar el listado. Recarga la página."
        );
      }
    } catch (err) {
      setErrorFormulario(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function abrirConfirmacionEstado(bus) {
  setErrorEstado("");
  setMensajeEstado("");
  setNuevoEstadoSeleccionado(
    bus.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO"
  );
  setBusConfirmandoEstado(bus);
}

  function cerrarConfirmacionEstado() {
    if (busCambiandoEstado) return;

    setBusConfirmandoEstado(null);
    setErrorEstado("");
    setMensajeEstado("");
  }

  async function cambiarEstadoBus() {
    if (!busConfirmandoEstado || busCambiandoEstado) return;

    const bus = busConfirmandoEstado;

    const nuevoEstado = nuevoEstadoSeleccionado;

    setBusCambiandoEstado(bus.id);
    setErrorEstado("");
    setMensajeEstado("");

    try {
      await busesService.cambiarEstado(bus.id, nuevoEstado);

      try {
        await cargarDatos();

        setMensajeEstado(
          `La unidad ${bus.numero_unidad} ahora se encuentra ${nuevoEstado}.`
        );

        setBusConfirmandoEstado({
          ...bus,
          estado: nuevoEstado,
        });

        if (busDetalle?.id === bus.id) {
          setBusDetalle((anterior) =>
            anterior ? { ...anterior, estado: nuevoEstado } : null
          );
        }
      } catch {
        setError(
          "Estado actualizado, pero no se pudo refrescar el listado. Recarga la página."
        );
        setBusConfirmandoEstado(null);
      }
    } catch (err) {
      setErrorEstado(
        err.message || "No se pudo cambiar el estado del bus."
      );
    } finally {
      setBusCambiandoEstado(null);
    }
  }

  function abrirDetalle(bus) {
    setBusDetalle(bus);
  }

  function cerrarDetalle() {
    setBusDetalle(null);
  }

  const totalActivos = buses.filter(
    (bus) => bus.estado === "ACTIVO"
  ).length;

  const totalInactivos = buses.filter(
    (bus) => bus.estado === "INACTIVO"
  ).length;

  const totalMantenimiento = buses.filter(
  (bus) => bus.estado === "MANTENIMIENTO"
).length;

  return (
    <section className="panel">
      {/* ENCABEZADO */}
      <div className="seccion-cab">
        <div>
          <h3>Flota de buses</h3>
          <p>Administra los vehículos de tu cooperativa.</p>
        </div>

        <button
          type="button"
          className="btn btn-oscuro"
          onClick={abrirRegistro}
          disabled={
            cargando ||
            !!error ||
            grupos.length === 0 ||
            !!busCambiandoEstado
          }
        >
          + Registrar bus
        </button>
      </div>

      {/* RESUMEN */}
      {!cargando && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            margin: "22px 0",
          }}
        >
          {[
            {
              titulo: "Total de buses",
              valor: buses.length,
              color: "#1d426d",
            },
            {
              titulo: "Buses activos",
              valor: totalActivos,
              color: "#15803d",
            },

            {
  titulo: "En mantenimiento",
  valor: totalMantenimiento,
  color: "#92400e",
},
            {
              titulo: "Buses inactivos",
              valor: totalInactivos,
              color: "#b91c1c",
            },
          ].map((item) => (
            <div
              key={item.titulo}
              style={{
                background: "#fff",
                border: "1px solid #e5eaf0",
                borderRadius: 14,
                padding: 17,
              }}
            >
              <div style={{ color: "#718096", fontSize: 13 }}>
                {item.titulo}
              </div>
              <div
                style={{
                  fontSize: 27,
                  fontWeight: 800,
                  color: item.color,
                  marginTop: 5,
                }}
              >
                {item.valor}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ESTADOS DE CARGA */}
      {cargando && <p>Cargando flota...</p>}

      {error && (
        <div
          role="alert"
          style={{
            padding: 14,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 12,
            marginTop: 15,
          }}
        >
          {error}
        </div>
      )}

      {!cargando && !error && grupos.length === 0 && (
        <p className="muted">
          No hay grupos activos disponibles. Primero debes registrar
          un grupo de buses para esta cooperativa.
        </p>
      )}

      {!cargando && !error && buses.length === 0 && (
        <p>Aún no hay buses registrados.</p>
      )}

      {/* TABLA DE FLOTA */}
      {!cargando && !error && buses.length > 0 && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Placa</th>
                <th>Grupo</th>
                <th>Chasis</th>
                <th>Carrocería</th>
                <th>Capacidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {buses.map((bus) => (
                <tr key={bus.id}>
                  <td>{bus.numero_unidad}</td>
                  <td>{bus.placa}</td>
                  <td>{bus.grupos_buses?.nombre ?? "Sin grupo"}</td>
                  <td>{bus.marca_chasis}</td>
                  <td>{bus.marca_carroceria}</td>
                  <td>{bus.capacidad} pasajeros</td>

                  <td>
                    <EtiquetaEstado estado={bus.estado} />
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-claro"
                        onClick={() => abrirDetalle(bus)}
                        disabled={
                          guardando || !!busCambiandoEstado
                        }
                      >
                        Ver detalles
                      </button>

                      <button
                        type="button"
                        className="btn btn-claro"
                        onClick={() => abrirEdicion(bus)}
                        disabled={
                          guardando || !!busCambiandoEstado
                        }
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="btn btn-claro"
                        onClick={() =>
                          abrirConfirmacionEstado(bus)
                        }
                        disabled={
                          guardando || !!busCambiandoEstado
                        }
                      >
                        {bus.estado === "ACTIVO"
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: INFORMACIÓN COMPLETA DEL BUS */}
      {busDetalle && (
        <Dialogo overlayProps={{"style": overlayStyle, "onMouseDown": (e) => {
            if (e.target === e.currentTarget) cerrarDetalle();
          }}} panelProps={{"role": "dialog", "aria-modal": "true", "aria-labelledby": "titulo-detalle-bus", "className": "panel", "style": modalStyle}}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div>
                <h3
                  id="titulo-detalle-bus"
                  style={{ margin: 0, color: "#1b304b" }}
                >
                  Información del vehículo
                </h3>
                <p style={{ margin: "5px 0 0", color: "#718096" }}>
                  Ficha completa de la unidad
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarDetalle}
                aria-label="Cerrar detalles"
                style={{
                  border: 0,
                  background: "#f1f5f9",
                  borderRadius: 10,
                  width: 38,
                  height: 38,
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* IMAGEN */}
            {busDetalle.imagen_url ? (
              <img
                src={busDetalle.imagen_url}
                alt={`Bus ${busDetalle.numero_unidad}`}
                style={{
                  width: "100%",
                  height: 230,
                  objectFit: "cover",
                  borderRadius: 15,
                  marginBottom: 18,
                  background: "#f1f5f9",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                style={{
                  height: 150,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 15,
                  background: "#f1f5f9",
                  color: "#64748b",
                  marginBottom: 18,
                  fontSize: 42,
                }}
              >
                🚌
                <span style={{ fontSize: 13 }}>
                  Sin fotografía registrada
                </span>
              </div>
            )}

            {/* IDENTIFICACIÓN */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: "#1b304b",
                    fontSize: 25,
                  }}
                >
                  Unidad {busDetalle.numero_unidad}
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#64748b",
                  }}
                >
                  Placa: {busDetalle.placa}
                </p>
              </div>

              <EtiquetaEstado estado={busDetalle.estado} />
            </div>

            {/* INFORMACIÓN GENERAL */}
            <h4 style={{ color: "#1b304b", marginBottom: 12 }}>
              Datos generales
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(145px, 1fr))",
                gap: 11,
              }}
            >
              <DatoBus
                etiqueta="Grupo"
                valor={busDetalle.grupos_buses?.nombre}
              />

              <DatoBus
                etiqueta="Tipo de grupo"
                valor={busDetalle.grupos_buses?.tipo}
              />

              <DatoBus
                etiqueta="Color"
                valor={busDetalle.color}
              />

              <DatoBus
                etiqueta="Marca del chasis"
                valor={busDetalle.marca_chasis}
              />

              <DatoBus
                etiqueta="Carrocería"
                valor={busDetalle.marca_carroceria}
              />

              <DatoBus
                etiqueta="Año"
                valor={busDetalle.anio}
              />

              <DatoBus
                etiqueta="Número de pisos"
                valor={busDetalle.pisos}
              />

              <DatoBus
                etiqueta="Capacidad"
                valor={
                  busDetalle.capacidad
                    ? `${busDetalle.capacidad} pasajeros`
                    : null
                }
              />

              <DatoBus
                etiqueta="Número de unidad"
                valor={busDetalle.numero_unidad}
              />

              <DatoBus
                etiqueta="Placa"
                valor={busDetalle.placa}
              />
            </div>

            {/* COMODIDADES */}
            <h4
              style={{
                color: "#1b304b",
                margin: "23px 0 12px",
              }}
            >
              Comodidades del vehículo
            </h4>

            {busDetalle.bus_comodidades?.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 9,
                }}
              >
                {busDetalle.bus_comodidades.map((item, index) => (
                  <span
                    key={item.comodidad ?? index}
                    style={{
                      padding: "9px 13px",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ✓ {item.comodidades?.nombre ?? item.comodidad}
                  </span>
                ))}
              </div>
            ) : (
              <p
                style={{
                  background: "#f7f9fc",
                  borderRadius: 10,
                  padding: 14,
                  color: "#718096",
                  fontSize: 13,
                }}
              >
                No hay comodidades registradas para esta unidad.
              </p>
            )}

            {/* ACCIONES */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 25,
                borderTop: "1px solid #e5eaf0",
                paddingTop: 18,
              }}
            >
              <button
                type="button"
                className="btn btn-claro"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-oscuro"
                onClick={() => abrirEdicion(busDetalle)}
              >
                Editar vehículo
              </button>
            </div>
          </Dialogo>
      )}

      {/* MODAL: ACTIVAR / DESACTIVAR */}
      {busConfirmandoEstado && (
        <Dialogo overlayProps={{"style": overlayStyle, "onMouseDown": (e) => {
            if (e.target === e.currentTarget) {
              cerrarConfirmacionEstado();
            }
          }}} panelProps={{"role": "dialog", "aria-modal": "true", "aria-labelledby": "titulo-confirmar-estado", "className": "panel", "style": {
              ...modalStyle,
              maxWidth: 460,
              textAlign: "center",
            }}}>
            <div
              style={{
                width: 66,
                height: 66,
                margin: "0 auto 15px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                background:
                  busConfirmandoEstado.estado === "ACTIVO"
                    ? "#fee2e2"
                    : "#dcfce7",
              }}
            >
              {busConfirmandoEstado.estado === "ACTIVO"
                ? "⏸"
                : "✓"}
            </div>

            <h3
              id="titulo-confirmar-estado"
              style={{ color: "#1b304b", margin: "0 0 10px" }}
            >
              {mensajeEstado
                ? "Estado actualizado"
                : busConfirmandoEstado.estado === "ACTIVO"
                  ? "¿Desactivar vehículo?"
                  : "¿Activar vehículo?"}
            </h3>

            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              {mensajeEstado
                ? mensajeEstado
                : `Estás a punto de ${
                    busConfirmandoEstado.estado === "ACTIVO"
                      ? "desactivar"
                      : "activar"
                  } la unidad ${
                    busConfirmandoEstado.numero_unidad
                  } con placa ${busConfirmandoEstado.placa}.`}
            </p>

            {!mensajeEstado && (
              <div
                style={{
                  background: "#f7f9fc",
                  padding: 15,
                  borderRadius: 12,
                  margin: "18px 0",
                  textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <strong>Unidad:</strong>{" "}
                  {busConfirmandoEstado.numero_unidad}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Placa:</strong>{" "}
                  {busConfirmandoEstado.placa}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Grupo:</strong>{" "}
                  {busConfirmandoEstado.grupos_buses?.nombre ??
                    "Sin grupo"}
                </div>
                <div>
                  <strong>Estado actual:</strong>{" "}
                  {busConfirmandoEstado.estado}
                </div>
              </div>
            )}
            {!mensajeEstado && (
  <label
    style={{
      display: "block",
      textAlign: "left",
      marginBottom: 16,
      fontWeight: 700,
    }}
  >
    Nuevo estado

    <select
      value={nuevoEstadoSeleccionado}
      onChange={(e) =>
        setNuevoEstadoSeleccionado(e.target.value)
      }
      disabled={!!busCambiandoEstado}
      style={{
        display: "block",
        width: "100%",
        marginTop: 8,
        padding: 10,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
      }}
    >
      {["ACTIVO", "INACTIVO", "MANTENIMIENTO"]
        .filter(
          (estado) =>
            estado !== busConfirmandoEstado.estado
        )
        .map((estado) => (
          <option key={estado} value={estado}>
            {estado}
          </option>
        ))}
    </select>
  </label>
)}
            {errorEstado && (
              <div
                role="alert"
                style={{
                  padding: 12,
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: 10,
                  marginBottom: 15,
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                {errorEstado}
              </div>
            )}

            {mensajeEstado && (
              <div
                role="status"
                style={{
                  padding: 12,
                  background: "#dcfce7",
                  color: "#166534",
                  borderRadius: 10,
                  marginBottom: 15,
                  fontSize: 13,
                }}
              >
                ✓ {mensajeEstado}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="btn btn-claro"
                disabled={!!busCambiandoEstado}
                onClick={cerrarConfirmacionEstado}
              >
                {mensajeEstado ? "Cerrar" : "Cancelar"}
              </button>

              {!mensajeEstado && (
                <button
                  type="button"
                  className="btn btn-oscuro"
                  disabled={!!busCambiandoEstado}
                  onClick={cambiarEstadoBus}
                >
                  {busCambiandoEstado
                    ? "Procesando..."
                    : busConfirmandoEstado.estado === "ACTIVO"
                      ? "Sí, desactivar"
                      : "Sí, activar"}
                </button>
              )}
            </div>
          </Dialogo>
      )}

      {/* MODAL: REGISTRAR / EDITAR */}
      {mostrarFormulario && (
        <Dialogo overlayProps={{"style": overlayStyle, "onMouseDown": (e) => {
            if (e.target === e.currentTarget) cerrarFormulario();
          }}} panelProps={{"role": "dialog", "aria-modal": "true", "aria-labelledby": "titulo-registro-bus", "className": "panel", "style": {
              ...modalStyle,
              maxWidth: 650,
            }}}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <h3
                  id="titulo-registro-bus"
                  style={{ margin: 0, color: "#1b304b" }}
                >
                  {busEditando
                    ? "Editar vehículo"
                    : "Registrar nuevo bus"}
                </h3>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#718096",
                    fontSize: 13,
                  }}
                >
                  Completa la información del vehículo.
                </p>
              </div>

              <button
                type="button"
                aria-label="Cerrar formulario"
                disabled={guardando}
                onClick={cerrarFormulario}
                style={{
                  border: 0,
                  background: "#f1f5f9",
                  borderRadius: 10,
                  width: 38,
                  height: 38,
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarBus}>
              <div
                className="form-fila"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 15,
                }}
              >
                <label>
                  Grupo
                  <select
                    required
                    value={form.grupoId}
                    onChange={(e) =>
                      actualizar("grupoId", e.target.value)
                    }
                  >
                    <option value="">Selecciona un grupo</option>

                    {grupos.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>
                        {grupo.nombre} ({grupo.tipo})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Número de unidad
                  <input
                    required
                    maxLength={100}
                    value={form.numeroUnidad}
                    onChange={(e) =>
                      actualizar("numeroUnidad", e.target.value)
                    }
                  />
                </label>

                <label>
                  Placa
                  <input
                    required
                    maxLength={100}
                    placeholder="TBA-1234"
                    value={form.placa}
                    onChange={(e) =>
                      actualizar("placa", e.target.value)
                    }
                  />
                </label>

                <label>
                  Color
                  <input
                    required
                    maxLength={100}
                    value={form.color}
                    onChange={(e) =>
                      actualizar("color", e.target.value)
                    }
                  />
                </label>

                <label>
                  Marca del chasis
                  <input
                    required
                    maxLength={100}
                    value={form.marcaChasis}
                    onChange={(e) =>
                      actualizar("marcaChasis", e.target.value)
                    }
                  />
                </label>

                <label>
                  Marca de carrocería
                  <input
                    required
                    maxLength={100}
                    value={form.marcaCarroceria}
                    onChange={(e) =>
                      actualizar("marcaCarroceria", e.target.value)
                    }
                  />
                </label>

                <label>
                  Año
                  <input
                    type="number"
                    min="1950"
                    max={new Date().getFullYear() + 1}
                    value={form.anio}
                    onChange={(e) =>
                      actualizar("anio", e.target.value)
                    }
                  />
                </label>

                <label>
                  Pisos
                  <select
                    value={form.pisos}
                    onChange={(e) =>
                      actualizar("pisos", e.target.value)
                    }
                  >
                    <option value="1">1 piso</option>
                    <option value="2">2 pisos</option>
                    <option value="3">3 pisos</option>
                  </select>
                </label>

                <label>
                  Capacidad de pasajeros
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    value={form.capacidad}
                    onChange={(e) =>
                      actualizar("capacidad", e.target.value)
                    }
                  />
                </label>

                <label>
                  URL de imagen (opcional)
                  <input
                    type="url"
                    maxLength={2048}
                    value={form.imagenUrl}
                    onChange={(e) =>
                      actualizar("imagenUrl", e.target.value)
                    }
                  />
                </label>
              </div>

              <div style={{ marginTop: 22 }}>
  <h4 style={{ color: "#1b304b", marginBottom: 12 }}>
    Comodidades del vehículo
  </h4>

  {comodidadesDisponibles.length === 0 ? (
    <p style={{ color: "#64748b", fontSize: 13 }}>
      No hay comodidades disponibles.
    </p>
  ) : (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {comodidadesDisponibles.map((comodidad) => (
        <label
          key={comodidad.codigo}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 12,
            border: "1px solid #e5eaf0",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.comodidades.includes(
              comodidad.codigo
            )}
            onChange={(e) => {
              setForm((anterior) => ({
                ...anterior,
                comodidades: e.target.checked
                  ? [
                      ...anterior.comodidades,
                      comodidad.codigo,
                    ]
                  : anterior.comodidades.filter(
                      (codigo) =>
                        codigo !== comodidad.codigo
                    ),
              }));
            }}
          />
          {comodidad.nombre}
        </label>
      ))}
    </div>
  )}
</div>

              {errorFormulario && (
                <div
                  role="alert"
                  style={{
                    background: "#fee2e2",
                    color: "#991b1b",
                    padding: 13,
                    borderRadius: 10,
                    marginTop: 17,
                    fontSize: 13,
                  }}
                >
                  {errorFormulario}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: "1px solid #e5eaf0",
                }}
              >
                <button
                  type="button"
                  className="btn btn-claro"
                  disabled={guardando}
                  onClick={cerrarFormulario}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-oscuro"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : busEditando
                      ? "Guardar cambios"
                      : "Registrar vehículo"}
                </button>
              </div>
            </form>
          </Dialogo>
      )}
    </section>
  );
}

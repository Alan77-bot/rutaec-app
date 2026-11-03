
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
};

export default function TabFlota({ onTotalBusesChange }) {
  const [buses, setBuses] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorFormulario, setErrorFormulario] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ ...FORM_INICIAL });
  const [busEditando, setBusEditando] = useState(null);
  const [busCambiandoEstado, setBusCambiandoEstado] = useState(null);

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
    ])
      .then(([listaBuses, listaGrupos]) => {
        if (!activo) return;

        setBuses(listaBuses);
        setGrupos(listaGrupos);
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
    });

    setErrorFormulario("");
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

  async function cambiarEstadoBus(bus) {
    if (busCambiandoEstado) return;

    const nuevoEstado =
      bus.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    const accion =
      nuevoEstado === "ACTIVO" ? "activar" : "desactivar";

    const confirmado = window.confirm(
      `¿Seguro que deseas ${accion} el bus ${bus.numero_unidad} (${bus.placa})?`
    );

    if (!confirmado) return;

    setBusCambiandoEstado(bus.id);

    try {
      await busesService.cambiarEstado(bus.id, nuevoEstado);

      try {
        await cargarDatos();
        setError("");
      } catch {
        setError(
          "Estado actualizado, pero no se pudo refrescar el listado. Recarga la página."
        );
      }
    } catch (err) {
      window.alert(
        err.message || "No se pudo cambiar el estado del bus."
      );
    } finally {
      setBusCambiandoEstado(null);
    }
  }

  return (
    <section className="panel">
      <div className="seccion-cab">
        <div>
          <h3>Flota de buses</h3>
          <p>Administra los buses registrados en tu cooperativa.</p>
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
          Registrar bus
        </button>
      </div>

      {cargando && <p>Cargando flota...</p>}

      {error && <p role="alert">{error}</p>}

      {!cargando && !error && grupos.length === 0 && (
        <p className="muted">
          No hay grupos activos disponibles. Primero debes registrar
          un grupo de buses para esta cooperativa.
        </p>
      )}

      {!cargando && !error && buses.length === 0 && (
        <p>Aún no hay buses registrados.</p>
      )}

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
                  <td>{bus.capacidad}</td>
                  <td>{bus.estado}</td>
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
                        onClick={() => cambiarEstadoBus(bus)}
                        disabled={
                          guardando || !!busCambiandoEstado
                        }
                      >
                        {busCambiandoEstado === bus.id
                          ? "Procesando..."
                          : bus.estado === "ACTIVO"
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

      {mostrarFormulario && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-registro-bus"
            className="panel"
            style={{
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3 id="titulo-registro-bus">
              {busEditando ? "Editar bus" : "Registrar nuevo bus"}
            </h3>

            <form onSubmit={guardarBus}>
              <div className="form-fila">
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
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </label>

                <label>
                  Capacidad
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

              {errorFormulario && (
                <p role="alert">{errorFormulario}</p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 16,
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
                      : "Guardar bus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

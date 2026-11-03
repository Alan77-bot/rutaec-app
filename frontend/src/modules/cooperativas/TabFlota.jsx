import { useEffect, useState } from "react";
import { busesService } from "./services/buses.service";

export default function TabFlota() {
  const [buses, setBuses] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    busesService.listar()
      .then((datos) => {
        if (activo) setBuses(datos);
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

  return (
    <section className="panel">
      <h3>Flota de buses</h3>

      {cargando && <p>Cargando flota...</p>}

      {error && <p role="alert">{error}</p>}

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

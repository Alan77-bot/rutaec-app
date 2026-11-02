// Plano del bus con los asientos reales del viaje. Agrupa por piso y fila, deja el
// pasillo entre las columnas 2 y 3 (buses de 4 columnas) y respeta los huecos.

import {
  ESTILO_ACCESIBLE,
  ESTILO_NO_VENDIBLE,
  ESTILO_PREFERENCIAL,
  ESTILO_RETENIDO,
} from './asientos.estilos'

const por = (a, b) => a - b

function descripcion(a, columnaMax) {
  const partes = [`Asiento ${a.numero}`, a.categoria === 'VIP' ? 'VIP' : 'Normal']
  if (a.precio !== null) partes.push(`$${a.precio.toFixed(2)}`)
  partes.push(a.columna === 1 || a.columna === columnaMax ? 'ventana' : 'pasillo')
  if (a.accesible) partes.push('accesible')
  if (a.preferencial) partes.push('preferencial')
  if (a.estado === 'OCUPADO') partes.push('ocupado')
  if (a.estado === 'RETENIDO') partes.push('reservado por otra persona')
  if (a.estado === 'NO_VENDIBLE') partes.push('no disponible')
  return partes.join(' · ')
}

function estiloDe(a) {
  return {
    ...(a.estado === 'RETENIDO' ? ESTILO_RETENIDO : {}),
    ...(a.estado === 'NO_VENDIBLE' ? ESTILO_NO_VENDIBLE : {}),
    ...(a.accesible ? ESTILO_ACCESIBLE : {}),
    ...(!a.accesible && a.preferencial ? ESTILO_PREFERENCIAL : {}),
  }
}

export default function MapaAsientos({ asientos, elegidos, onElegir, onNoDisponible }) {
  const pisos = [...new Set(asientos.map((a) => a.piso))].sort(por)
  const columnaMax = Math.max(0, ...asientos.map((a) => a.columna))

  return (
    <div className="mapa" role="group" aria-label="Plano de asientos del bus">
      {pisos.map((piso) => {
        const delPiso = asientos.filter((a) => a.piso === piso)
        const filas = [...new Set(delPiso.map((a) => a.fila))].sort(por)

        return (
          <div key={piso} className="piso" role="group" aria-label={`Piso ${piso}`}>
            {pisos.length > 1 && <h5>Piso {piso}</h5>}
            {piso === pisos[0] && (
              <div className="cabina">
                <span className="volante" aria-hidden="true">◎</span>
              </div>
            )}
            {filas.map((fila) => {
              const delaFila = delPiso.filter((a) => a.fila === fila)

              return (
                <div key={fila} className="fila">
                  {Array.from({ length: columnaMax }, (_, i) => i + 1).map((columna) => {
                    const a = delaFila.find((x) => x.columna === columna)
                    const pasillo = columnaMax >= 4 && columna === 3

                    return (
                      <span key={columna} className="celda">
                        {pasillo && <i className="pasillo" />}
                        {a ? (
                          <button
                            type="button"
                            className={
                              'asiento ' +
                              (a.categoria === 'VIP' ? 'vip' : 'normal') +
                              (a.estado !== 'LIBRE' ? ' ocupado' : '') +
                              (elegidos.includes(a.id) ? ' sel' : '')
                            }
                            style={estiloDe(a)}
                            aria-pressed={elegidos.includes(a.id)}
                            aria-disabled={a.estado !== 'LIBRE'}
                            aria-label={descripcion(a, columnaMax) + (elegidos.includes(a.id) ? ' · seleccionado' : '')}
                            title={descripcion(a, columnaMax)}
                            onClick={() => (a.estado === 'LIBRE' ? onElegir(a) : onNoDisponible?.(a))}
                          >
                            {a.numero}
                          </button>
                        ) : (
                          <i style={{ display: 'inline-block', width: 40, height: 40 }} aria-hidden="true" />
                        )}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

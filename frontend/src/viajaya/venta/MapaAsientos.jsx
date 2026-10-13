import { layoutAsientos } from '../data/viajes'

export default function MapaAsientos({ tipo, ocupados, elegidos, onClick, onDoble }) {
  const todos = layoutAsientos(tipo)
  const pisos = [...new Set(todos.map((a) => a.piso))]

  return (
    <div className="mapa">
      {pisos.map((p) => {
        const filas = [...new Set(todos.filter((a) => a.piso === p).map((a) => a.fila))]
        return (
          <div key={p} className="piso">
            {pisos.length > 1 && <h5>Piso {p}</h5>}
            <div className="cabina">
              <span className="volante">◎</span>
            </div>
            {filas.map((f) => (
              <div key={f} className={'fila' + (tipo === 'chiva' ? ' chiva' : '')}>
                {todos
                  .filter((a) => a.piso === p && a.fila === f)
                  .map((a, i) => {
                    const ocup = ocupados.has(a.id)
                    const sel = elegidos.includes(a.id)
                    return (
                      <span key={a.id} className="celda">
                        {tipo !== 'chiva' && i === 2 && <i className="pasillo" />}
                        <button
                          type="button"
                          className={'asiento ' + a.tipo + (ocup ? ' ocupado' : '') + (sel ? ' sel' : '')}
                          onClick={() => !ocup && onClick(a)}
                          onDoubleClick={() => onDoble(a)}
                          title={`${a.label} · ${a.tipo === 'vip' ? 'VIP' : 'Normal'}${a.letra === 'A' || a.letra === 'D' ? ' · ventana' : ' · pasillo'}`}
                        >
                          {a.label}
                        </button>
                      </span>
                    )
                  })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

import { useSearchParams } from 'react-router-dom'
import { apartadosGerente } from '../../data/apartados'
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { obtenerCooperativas } from './services/cooperativas.service'
import { busesService } from './services/buses.service'
import TabOficinistas from './TabOficinistas'
import TabFlota from './TabFlota'
import TabAsientos from './TabAsientos'
import TabPersonalizacion from './TabPersonalizacion'
import Rutas from '../rutas/Rutas'
import Frecuencias from '../horarios/Frecuencias'
import GestionCatalogo from '../../components/GestionCatalogo'
import HojaRuta from '../horarios/HojaRuta'
import { usePersonalizacion } from '../../context/PersonalizacionContext'



export default function PanelCoop() {
  const { sesion, cooperativas } = useApp()

  const [parametros] = useSearchParams()
  const seccion = parametros.get('seccion')
  const tab = apartadosGerente.some(o => o.id === seccion) ? seccion : 'hoja'
  const [cooperativaRemota, setCooperativaRemota] = useState(null)
  const [cargandoCoop, setCargandoCoop] = useState(true)
  const [errorCoop, setErrorCoop] = useState('')
  const [totalBuses, setTotalBuses] = useState(null)
  const [totalFrecuencias, setTotalFrecuencias] = useState(null)

  useEffect(() => {
    let vigente = true

    if (!sesion?.coopId) {
      setTotalBuses(null)
      return () => { vigente = false }
    }

    busesService.listar()
      .then((lista) => {
        if (vigente) setTotalBuses(lista.length)
      })
      .catch((error) => {
        console.error('No se pudo consultar el total de buses:', error)
      })

    return () => { vigente = false }
  }, [sesion?.coopId])

  useEffect(() => {
    let vigente = true

    async function cargarCooperativa() {
      setCargandoCoop(true)
      setErrorCoop('')
      setCooperativaRemota(null)

      try {
        const lista = await obtenerCooperativas()

        const encontrada = lista.find(
          (c) => c.id === sesion?.coopId
        )

        if (vigente) {
          setCooperativaRemota(encontrada ?? null)
        }
      } catch (error) {
        if (vigente) {
          setErrorCoop(
            error.message || 'No se pudo consultar la cooperativa.'
          )
        }
      } finally {
        if (vigente) {
          setCargandoCoop(false)
        }
      }
    }

    if (sesion?.coopId) {
      cargarCooperativa()
    } else {
      setCargandoCoop(false)
    }

    return () => {
      vigente = false
    }
  }, [sesion?.coopId])

  const cooperativaLocal = cooperativas.find(
    (c) => c.id === sesion?.coopId
  )

  const { cooperativa: identidad } = usePersonalizacion()
  const coop = identidad ?? cooperativaLocal ?? (
    cooperativaRemota
      ? {
          ...cooperativaRemota,
          nombre: cooperativaRemota.nombre_comercial,
          color: '#1d3f8f',
        }
      : null
  )

  if (cargandoCoop && !coop) {
    return (
      <div className="contenedor vacio">
        <b>Cargando tu cooperativa...</b>
      </div>
    )
  }

  if (errorCoop && !coop) {
    return (
      <div className="contenedor vacio">
        <b>{errorCoop}</b>
      </div>
    )
  }

  if (!coop) {
    return (
      <div className="contenedor vacio">
        <b>Tu usuario no tiene una cooperativa asignada.</b>
      </div>
    )
  }


  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Cooperativa {coop.nombre}</h1>
        <p>
          Administra tu flota, las frecuencias asignadas,
          la hoja de ruta y el personal de tu cooperativa.
        </p>
      </div>

      <div className="resumen-panel" aria-label="Resumen de flota"><span><strong>{totalBuses ?? '—'}</strong> buses registrados</span><span><strong>{totalFrecuencias ?? '—'}</strong> frecuencias {totalFrecuencias === null ? 'por consultar' : 'consultadas'}</span><span>Gestión exclusiva de tu cooperativa</span></div>

      {tab === 'grupos' && <GestionCatalogo recurso="grupos" />}
      {tab === 'hoja' && <HojaRuta />}

      {tab === 'frec' && <Frecuencias integrada onTotalChange={setTotalFrecuencias} />}

      {tab === 'resoluciones' && <GestionCatalogo recurso="resoluciones" />}
      {tab === 'cuentas' && <GestionCatalogo recurso="cuentas" />}
      {tab === 'rutas' && <Rutas integrada />}
      {tab === 'buses' && <TabFlota onTotalBusesChange={setTotalBuses} />}

      {tab === 'asientos' && <TabAsientos cooperativaId={coop.id} />}

      {tab === 'oficinistas' && <TabOficinistas />}

      {tab === 'personalizacion' && (identidad ? <TabPersonalizacion coop={identidad} /> : <p role="status">Cargando personalización…</p>)}
    </div>
  )
}



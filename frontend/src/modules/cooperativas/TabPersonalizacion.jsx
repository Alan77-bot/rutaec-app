import Dialogo from '../../components/ui/Dialogo'
import { useEffect, useMemo, useState } from 'react'
import './TabPersonalizacion.css'
import { guardarPersonalizacion } from './services/personalizacion.service'

const VALORES = {
  color_primario: '#16324F',
  color_secundario: '#FFFFFF',
  logo: '',
  fotografia: '',
  correo: '',
  telefono: '',
  direccion: '',
  sitio_web: '',
  facebook: '',
  instagram: '',
  whatsapp: ''
}

function prepararDatos(coop) {
  const redes = coop?.redes_sociales || {}

  const colorPrincipal = coop?.color_primario || coop?.color

  return {
    ...VALORES,
    color_primario:
      /^#[0-9a-f]{6}$/i.test(colorPrincipal || '')
        ? colorPrincipal
        : VALORES.color_primario,
    color_secundario:
      /^#[0-9a-f]{6}$/i.test(coop?.color_secundario || '')
        ? coop.color_secundario
        : VALORES.color_secundario,
    logo: coop?.logo || '',
    fotografia: coop?.fotografia || '',
    correo: coop?.correo || '',
    telefono: coop?.telefono || '',
    direccion: coop?.direccion || '',
    sitio_web: coop?.sitio_web || '',
    facebook: redes.facebook || '',
    instagram: redes.instagram || '',
    whatsapp: redes.whatsapp || ''
  }
}

function validarEnlace(valor) {
  if (!valor.trim()) return true

  try {
    const url = new URL(valor)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function cargarImagen(archivo, correcto, fallo) {
  if (!archivo) return

  const permitidos = [
    'image/png',
    'image/jpeg',
    'image/webp'
  ]

  if (!permitidos.includes(archivo.type)) {
    fallo('Solo se permiten imágenes PNG, JPG o WEBP.')
    return
  }

  if (archivo.size > 2 * 1024 * 1024) {
    fallo('La imagen debe pesar como máximo 2 MB.')
    return
  }

  const lector = new FileReader()

  lector.onload = () => {
    correcto(String(lector.result || ''))
  }

  lector.onerror = () => {
    fallo('No se pudo leer la imagen seleccionada.')
  }

  lector.readAsDataURL(archivo)
}

function Campo({
  titulo,
  valor,
  cambiar,
  tipo = 'text',
  placeholder = ''
}) {
  return (
    <label className="pc-campo">
      <span>{titulo}</span>
      <input
        type={tipo}
        value={valor}
        placeholder={placeholder}
        onChange={(evento) => cambiar(evento.target.value)}
      />
    </label>
  )
}

function Seccion({ numero, titulo, descripcion, children }) {
  return (
    <section className="pc-tarjeta">
      <header className="pc-tarjeta-cabecera">
        <span className="pc-numero">{numero}</span>
        <div>
          <h3>{titulo}</h3>
          <p>{descripcion}</p>
        </div>
      </header>

      {children}
    </section>
  )
}

export default function TabPersonalizacion({ coop }) {
  const [form, setForm] = useState(() => prepararDatos(coop))
  const [original, setOriginal] = useState(() => prepararDatos(coop))

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  useEffect(() => {
    const datos = prepararDatos(coop)

    setForm(datos)
    setOriginal(datos)
    setError('')
    setMensaje('')
    setMostrarConfirmacion(false)
  }, [coop?.id])

  const hayCambios = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(original)
  }, [form, original])

  useEffect(() => {
    if (!hayCambios) return undefined

    const advertir = (evento) => {
      evento.preventDefault()
      evento.returnValue = ''
    }

    window.addEventListener('beforeunload', advertir)

    return () => {
      window.removeEventListener('beforeunload', advertir)
    }
  }, [hayCambios])

  const cambiar = (campo, valor) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor
    }))

    setError('')
    setMensaje('')
  }

  const seleccionarImagen = (campo, evento) => {
    const archivo = evento.target.files?.[0]
    if (campo === 'logo' && archivo?.type === 'image/webp') {
      setError('Para el logotipo utiliza PNG o JPG, compatibles con los boletos PDF.')
      evento.target.value = ''
      return
    }

    cargarImagen(
      archivo,
      (imagen) => cambiar(campo, imagen),
      setError
    )

    evento.target.value = ''
  }

  const descartar = () => {
    setForm({ ...original })
    setMostrarConfirmacion(false)
    setError('')
    setMensaje('Se restauró la vista previa original.')
  }

  const validar = async () => {
    if (guardando) return
    if (
      !/^#[0-9a-f]{6}$/i.test(form.color_primario) ||
      !/^#[0-9a-f]{6}$/i.test(form.color_secundario)
    ) {
      setError('Revisa el formato de los colores corporativos.')
      return
    }

    if (
      form.correo.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())
    ) {
      setError('El correo electrónico no tiene un formato válido.')
      return
    }

    for (const campo of ['sitio_web', 'facebook', 'instagram']) {
      if (!validarEnlace(form[campo])) {
        setError(`El enlace de ${campo.replace('_', ' ')} no es válido.`)
        return
      }
    }

    setError('')
    setGuardando(true)
    try {
      const datos = await guardarPersonalizacion(coop.id, form)
      const guardados = prepararDatos(datos)
      setForm(guardados)
      setOriginal(guardados)
      setMensaje('Personalización guardada correctamente.')
      window.dispatchEvent(new CustomEvent('coop:personalizacion', { detail: datos }))
    } catch (e) {
      setError(e.message || 'No se pudo guardar la personalización.')
    } finally {
      setGuardando(false)
    }
  }

  const nombre =
    coop?.nombre ||
    coop?.nombre_comercial ||
    'Mi cooperativa'

  const colorTexto =
    /^#[0-9a-f]{6}$/i.test(form.color_secundario)
      ? form.color_secundario
      : '#FFFFFF'

  const colorFondo =
    /^#[0-9a-f]{6}$/i.test(form.color_primario)
      ? form.color_primario
      : '#16324F'

  return (
    <div className="pc-modulo">
      <header className="pc-encabezado">
        <div>
          <span className="pc-sobretitulo">
            IDENTIDAD CORPORATIVA
          </span>

          <h2>Personalización</h2>

          <p>
            Define cómo se verá tu cooperativa
            en los espacios digitales de RutaEC.
          </p>
        </div>

        <span className="pc-etiqueta">
          Identidad de tu cooperativa
        </span>
      </header>

      <div className="pc-informacion">
        <strong>Identidad compartida</strong>
        <p>
          Los cambios guardados se aplican a tu cooperativa y a sus oficinistas, sin modificar la identidad de otras cooperativas.
        </p>
      </div>

      {hayCambios && (
        <div className="pc-pendientes">
          <span>
            Tienes cambios sin guardar en el servidor.
          </span>

          <button
            type="button"
            disabled={guardando}
            onClick={() => setMostrarConfirmacion(true)}
          >
            Descartar
          </button>
        </div>
      )}

      {error && (
        <div className="pc-error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="pc-exito" role="status">
          {mensaje}
        </div>
      )}

      <div className="pc-layout">
        <fieldset className="pc-formularios" disabled={guardando} style={{ border: 0, padding: 0, margin: 0 }}>
          <Seccion
            numero="01"
            titulo="Identidad visual"
            descripcion="Selecciona los colores y las imágenes de tu marca."
          >
            <div className="pc-grid">
              {[
                ['color_primario', 'Color principal'],
                ['color_secundario', 'Color secundario']
              ].map(([campo, titulo]) => (
                <label className="pc-campo" key={campo}>
                  <span>{titulo}</span>

                  <div className="pc-color-control">
                    <input
                      type="color"
                      value={
                        /^#[0-9a-f]{6}$/i.test(form[campo])
                          ? form[campo]
                          : '#FFFFFF'
                      }
                      onChange={(evento) => {
                        cambiar(campo, evento.target.value)
                      }}
                    />

                    <input
                      type="text"
                      maxLength={7}
                      value={form[campo]}
                      onChange={(evento) => {
                        cambiar(campo, evento.target.value)
                      }}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className="pc-grid pc-separacion">
              <label className="pc-campo">
                <span>Logotipo</span>

                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(evento) => {
                    seleccionarImagen('logo', evento)
                  }}
                />

                <small>
                  PNG o JPG · Máximo 2 MB
                </small>

                {form.logo && (
                  <button
                    type="button"
                    className="pc-enlace"
                    onClick={() => cambiar('logo', '')}
                  >
                    Quitar imagen
                  </button>
                )}
              </label>

              <label className="pc-campo">
                <span>Fotografía de portada</span>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(evento) => {
                    seleccionarImagen('fotografia', evento)
                  }}
                />

                <small>
                  Imagen de portada · Máximo 2 MB
                </small>

                {form.fotografia && (
                  <button
                    type="button"
                    className="pc-enlace"
                    onClick={() => cambiar('fotografia', '')}
                  >
                    Quitar imagen
                  </button>
                )}
              </label>
            </div>
          </Seccion>

          <Seccion
            numero="02"
            titulo="Información de contacto"
            descripcion="Datos de contacto públicos de tu cooperativa."
          >
            <div className="pc-grid">
              <Campo
                titulo="Correo electrónico"
                tipo="email"
                valor={form.correo}
                cambiar={(valor) => cambiar('correo', valor)}
                placeholder="contacto@cooperativa.com"
              />

              <Campo
                titulo="Teléfono"
                tipo="tel"
                valor={form.telefono}
                cambiar={(valor) => cambiar('telefono', valor)}
                placeholder="0999999999"
              />

              <Campo
                titulo="Dirección"
                valor={form.direccion}
                cambiar={(valor) => cambiar('direccion', valor)}
                placeholder="Dirección de la cooperativa"
              />

              <Campo
                titulo="Sitio web"
                tipo="url"
                valor={form.sitio_web}
                cambiar={(valor) => cambiar('sitio_web', valor)}
                placeholder="https://ejemplo.com"
              />
            </div>
          </Seccion>

          <Seccion
            numero="03"
            titulo="Redes sociales"
            descripcion="Configura los canales oficiales de comunicación."
          >
            <div className="pc-grid">
              <Campo
                titulo="Facebook"
                valor={form.facebook}
                cambiar={(valor) => cambiar('facebook', valor)}
                placeholder="https://facebook.com/..."
              />

              <Campo
                titulo="Instagram"
                valor={form.instagram}
                cambiar={(valor) => cambiar('instagram', valor)}
                placeholder="https://instagram.com/..."
              />

              <Campo
                titulo="WhatsApp"
                valor={form.whatsapp}
                cambiar={(valor) => cambiar('whatsapp', valor)}
                placeholder="Número de contacto"
              />
            </div>
          </Seccion>
        </fieldset>

        <aside className="pc-preview-panel">
          <div className="pc-preview-titulo">
            <h3>Vista previa</h3>
            <span>En tiempo real</span>
          </div>

          <div className="pc-preview-card">
            <div
              className="pc-portada"
              style={{ background: colorFondo }}
            >
              {form.fotografia && (
                <img
                  src={form.fotografia}
                  alt="Fotografía de portada"
                />
              )}
            </div>

            <div className="pc-preview-contenido">
              <div
                className="pc-logo"
                style={{ borderColor: colorFondo }}
              >
                {form.logo ? (
                  <img
                    src={form.logo}
                    alt={`Logotipo de ${nombre}`}
                  />
                ) : (
                  <span style={{ color: colorFondo }}>
                    {nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <h3>{nombre}</h3>

              <p className="pc-subtitulo">
                Tu cooperativa, tu identidad.
              </p>

              <div className="pc-paleta">
                <span
                  style={{ background: colorFondo }}
                  title="Color principal"
                />

                <span
                  style={{ background: colorTexto }}
                  title="Color secundario"
                />
              </div>

              <div className="pc-contacto">
                {form.correo && <p>{form.correo}</p>}
                {form.telefono && <p>{form.telefono}</p>}
                {form.direccion && <p>{form.direccion}</p>}
                {form.sitio_web && <p>{form.sitio_web}</p>}
              </div>

              <button
                type="button"
                disabled
                className="pc-boton-demo"
                style={{
                  background: colorFondo,
                  color: colorTexto
                }}
              >
                Botón de ejemplo
              </button>
            </div>
          </div>

          <div className="pc-preview-nota">
            Comprueba el resultado antes de guardar. La identidad guardada se comparte con el personal de tu cooperativa.
          </div>
        </aside>
      </div>

      <footer className="pc-footer">
        <p>
          Los cambios se guardan únicamente para tu cooperativa.
        </p>

        <button
          type="button"
          className="pc-boton-validar"
          disabled={!hayCambios || guardando}
          onClick={validar}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </footer>

      {mostrarConfirmacion && (
        <Dialogo overlayProps={{"className": "pc-modal-fondo"}} panelProps={{"className": "pc-modal", "role": "dialog", "aria-modal": "true", "aria-labelledby": "pc-modal-titulo"}}>
            <h3 id="pc-modal-titulo">
              ¿Descartar los cambios?
            </h3>

            <p>
              Se restaurará la configuración que
              estaba cargada al abrir esta pestaña.
            </p>

            <div className="pc-modal-botones">
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="pc-peligro"
                onClick={descartar}
              >
                Sí, descartar
              </button>
            </div>
          </Dialogo>
      )}
    </div>
  )
}

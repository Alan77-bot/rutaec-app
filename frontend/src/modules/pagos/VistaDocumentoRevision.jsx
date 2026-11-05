import { useEffect, useState } from 'react'
import Dialogo from '../../components/ui/Dialogo'

export default function VistaDocumentoRevision({ documento }) {
  const [archivo,setArchivo]=useState(null),[error,setError]=useState(''),[version,setVersion]=useState(0)
  const [ampliado,setAmpliado]=useState(false),[zoom,setZoom]=useState(100)
  useEffect(()=>{
    const control=new AbortController();let temporal
    setArchivo(null);setError('');setZoom(100);setAmpliado(false)
    if(!documento?.url)return()=>control.abort()
    fetch(documento.url,{credentials:'include',signal:control.signal}).then(async r=>{
      if(!r.ok)throw new Error(r.status===404?'El archivo no está disponible.':'No se pudo abrir el documento. Actualiza tu sesión e inténtalo otra vez.')
      const blob=await r.blob()
      if(!['image/png','image/jpeg','image/webp','application/pdf'].includes(blob.type))throw new Error('Este formato no admite vista previa.')
      if(control.signal.aborted)return
      temporal=URL.createObjectURL(blob);setArchivo({url:temporal,tipo:blob.type})
    }).catch(e=>{if(!control.signal.aborted)setError(e.message)})
    return()=>{control.abort();if(temporal)URL.revokeObjectURL(temporal)}
  },[documento?.url,version])
  if(!documento)return <div className="revision-documento-vacio"><span aria-hidden="true">▤</span><strong>Sin documento disponible</strong><p>Esta solicitud no tiene un archivo que se pueda mostrar.</p></div>
  const imagen=archivo?.tipo.startsWith('image/')
  const contenido=(grande=false)=><div className={`revision-lienzo ${grande?'ampliado':''}`}>
    {error?<div className="revision-documento-vacio" role="alert"><strong>{error}</strong><button type="button" className="btn btn-claro" onClick={()=>setVersion(v=>v+1)}>Reintentar</button></div>:!archivo?<p role="status">Cargando documento…</p>:imagen?<img src={archivo.url} alt={`Documento adjunto: ${documento.nombre}`} style={{width:`${zoom}%`}} onError={()=>setError('La imagen está dañada o no puede mostrarse.')}/>:<iframe src={archivo.url} title={`Documento PDF: ${documento.nombre}`} />}
  </div>
  return <section className="revision-documento" aria-label="Vista previa del documento">
    <div className="revision-documento-barra"><div><strong>{documento.nombre}</strong><small>{documento.tipo==='application/pdf'?'Documento PDF':'Imagen adjunta'}</small></div><div className="revision-herramientas">
      {imagen&&<><button type="button" aria-label="Reducir imagen" disabled={zoom<=50} onClick={()=>setZoom(v=>Math.max(50,v-25))}>−</button><button type="button" aria-label="Restablecer tamaño de imagen" onClick={()=>setZoom(100)}>{zoom}%</button><button type="button" aria-label="Ampliar imagen" disabled={zoom>=250} onClick={()=>setZoom(v=>Math.min(250,v+25))}>+</button></>}
      <button type="button" className="btn btn-claro" disabled={!archivo} onClick={()=>setAmpliado(true)}>Vista amplia</button><a className="btn btn-claro" href={documento.url} target="_blank" rel="noopener noreferrer">Abrir original ↗</a>
    </div></div>
    {contenido()}
    {ampliado&&<Dialogo overlayProps={{onMouseDown:e=>{if(e.target===e.currentTarget)setAmpliado(false)}}} panelProps={{className:'revision-documento-dialogo','aria-label':'Documento en vista amplia'}}><header className="revision-documento-barra"><strong>{documento.nombre}</strong><button type="button" aria-label="Cerrar vista amplia" onClick={()=>setAmpliado(false)}>×</button></header>{contenido(true)}</Dialogo>}
  </section>
}

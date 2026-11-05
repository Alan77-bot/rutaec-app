import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let estados,cursor,efecto,montado,solicitud,limpiar,creadas,revocadas
globalThis.revisionDocumentoHooks={
  useState(inicial){const i=cursor++;if(!(i in estados))estados[i]=typeof inicial==='function'?inicial():inicial;return[estados[i],valor=>{estados[i]=typeof valor==='function'?valor(estados[i]):valor}]},
  useEffect(callback){if(!montado)efecto=callback},
}
const original={fetch:globalThis.fetch,crear:URL.createObjectURL,revocar:URL.revokeObjectURL}
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},plugins:[{
  name:'revision-documento-test',enforce:'pre',
  transform(code,id){if(id.endsWith('/VistaDocumentoRevision.jsx'))return code.replace("from 'react'","from 'virtual:revision-documento-hooks'")},
  resolveId(id){if(id==='virtual:revision-documento-hooks')return '\0'+id},
  load(id){if(id==='\0virtual:revision-documento-hooks')return 'export const {useState,useEffect}=globalThis.revisionDocumentoHooks'},
},react()]})
const {default:Vista}=await server.ssrLoadModule('/src/modules/pagos/VistaDocumentoRevision.jsx')
after(async()=>{limpiar?.();globalThis.fetch=original.fetch;URL.createObjectURL=original.crear;URL.revokeObjectURL=original.revocar;delete globalThis.revisionDocumentoHooks;await server.close()})
const documento={id:'archivo',nombre:'documento.png',tipo:'image/png',url:'/api/reservas/descuentos/documentos/archivo'}
function render(){cursor=0;const arbol=Vista({documento});montado=true;return arbol}
function nodos(arbol){if(Array.isArray(arbol))return arbol.flatMap(nodos);if(!arbol||typeof arbol!=='object'||!arbol.props)return[];return[arbol,...nodos(arbol.props.children)]}
async function cargar({tipo='image/png',estado=200,desmontar=false}={}){
  limpiar?.();estados=[];cursor=0;montado=false;creadas=[];revocadas=[]
  URL.createObjectURL=blob=>{const url='blob:revision-'+creadas.length;creadas.push({url,tipo:blob.type});return url}
  URL.revokeObjectURL=url=>revocadas.push(url)
  globalThis.fetch=async(url,opciones)=>{solicitud={url,opciones};return{ok:estado===200,status:estado,blob:async()=>new Blob(['contenido'],{type:tipo})}}
  render();limpiar=efecto();if(desmontar)limpiar()
  await new Promise(r=>setImmediate(r));return render()
}
test('muestra la imagen dentro de la revisión usando la sesión actual',async()=>{
  const arbol=await cargar();const img=nodos(arbol).find(n=>n.type==='img')
  assert.ok(img);assert.equal(img.props.src,'blob:revision-0')
  assert.equal(solicitud.url,documento.url);assert.equal(solicitud.opciones.credentials,'include')
  const ampliar=nodos(arbol).find(n=>n.type==='button'&&n.props['aria-label']==='Ampliar imagen');ampliar.props.onClick()
  assert.equal(nodos(render()).find(n=>n.type==='img').props.style.width,'125%')
  limpiar();assert.ok(revocadas.includes('blob:revision-0'))
})
test('los PDF se muestran en un visor embebido identificado',async()=>{
  const arbol=await cargar({tipo:'application/pdf'});assert.ok(nodos(arbol).some(n=>n.type==='iframe'&&n.props.title.includes('Documento PDF')))
  assert.ok(!nodos(arbol).some(n=>n.type==='img'))
})
test('un archivo inexistente o un contenido HTML no se inserta como documento',async()=>{
  for(const opciones of [{estado:404},{tipo:'text/html'}]){
    const arbol=await cargar(opciones);assert.ok(nodos(arbol).some(n=>n.props.role==='alert'));assert.equal(creadas.length,0)
    assert.ok(!nodos(arbol).some(n=>n.type==='iframe'||n.type==='img'))
  }
})
test('al cambiar de pantalla se cancela la carga y no quedan URLs de archivos',async()=>{
  await cargar({desmontar:true});assert.equal(solicitud.opciones.signal.aborted,true);assert.equal(creadas.length,0)
})

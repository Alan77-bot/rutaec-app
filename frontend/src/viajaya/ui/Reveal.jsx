import { useEffect, useRef, useState } from 'react'

export default function Reveal({ children, delay = 0, className = '', as: Tag = 'div', ...resto }) {
  const ref = useRef(null)
  const [visto, setVisto] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisto(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    io.observe(el)
    const respaldo = setTimeout(() => setVisto(true), 1800)
    return () => {
      io.disconnect()
      clearTimeout(respaldo)
    }
  }, [])

  return (
    <Tag ref={ref} className={`reveal ${visto ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...resto}>
      {children}
    </Tag>
  )
}

export function Contador({ hasta, sufijo = '' }) {
  const [v, setV] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    let raf
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const ini = performance.now()
      const paso = (t) => {
        const p = Math.min(1, (t - ini) / 1100)
        setV(Math.round(hasta * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(paso)
      }
      raf = requestAnimationFrame(paso)
    })
    io.observe(el)
    const respaldo = setTimeout(() => setV(hasta), 2500)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(respaldo)
    }
  }, [hasta])
  return <span ref={ref}>{v}{sufijo}</span>
}

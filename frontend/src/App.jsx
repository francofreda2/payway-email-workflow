import React, { useState, useEffect, useCallback, useRef } from 'react'

const API = '/api'
const STATUSES = ['pendiente','en_proceso','respondido','cerrado']
const SL = { pendiente:'Pendiente', en_proceso:'En Proceso', respondido:'Respondido', cerrado:'Cerrado' }
const SI = { pendiente:'⏳', en_proceso:'🔄', respondido:'✅', cerrado:'📁' }
const PW = { blue:'#003C96', dark:'#002266', mid:'#1A5CB8', light:'#E8EEF8', accent:'#0FB496', bg:'#F4F6FA', bg2:'#EBF0F8', text:'#1E2B4A', muted:'#8A96B0', border:'#D5DDEC', white:'#FFFFFF', red:'#DC2626' }

const tag = (label, intensity) => {
  const alpha = intensity || '15'
  return { display:'inline-block', padding:'3px 10px', borderRadius:4, fontSize:10, fontWeight:700, whiteSpace:'nowrap', background:`${PW.blue}${alpha}`, color:PW.blue, border:`1px solid ${PW.blue}25` }
}
const urgStyle = (u) => {
  if (u === 'critica' || u === 'alta') return { ...tag(u), background:`${PW.red}12`, color:PW.red, border:`1px solid ${PW.red}25` }
  if (u === 'baja') return { ...tag(u), background:`${PW.accent}12`, color:PW.accent, border:`1px solid ${PW.accent}25` }
  return tag(u)
}
const ageBadge = (h) => {
  const danger = h > 48, warn = h > 24
  const bg = danger ? `${PW.red}12` : warn ? `${PW.blue}15` : `${PW.accent}12`
  const col = danger ? PW.red : warn ? PW.mid : PW.accent
  return <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:42, height:24, borderRadius:6, padding:'0 8px', fontSize:11, fontWeight:700, background:bg, color:col }}>{h}h</span>
}

function BarChart({ data, max: maxOverride, showPercentage = false }) {
  const entries = Object.entries(data).sort((a,b) => b[1]-a[1])
  const max = maxOverride || Math.max(...entries.map(e => e[1]), 1)
  const total = entries.reduce((sum, [,v]) => sum + v, 0)
  
  return entries.map(([k,v]) => {
    const percentage = total > 0 ? Math.round((v / total) * 100) : 0
    return (
      <div key={k} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
        <div style={{ fontSize:11, color:PW.text, width:120, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:600 }} title={k}>{k.replace(/_/g,' ')}</div>
        <div style={{ flex:1, background:PW.bg2, borderRadius:4, height:8, overflow:'hidden', position:'relative' }}>
          <div style={{ height:'100%', borderRadius:4, width:`${v/max*100}%`, background:`linear-gradient(90deg, ${PW.blue}, ${PW.mid})`, transition:'width .8s cubic-bezier(.16,1,.3,1)', boxShadow:'inset 0 1px 2px rgba(0,60,150,0.1)' }} />
        </div>
        <div style={{ fontSize:11, color:PW.text, width:32, textAlign:'right', flexShrink:0, fontWeight:700 }}>{v}</div>
        {showPercentage && <div style={{ fontSize:10, color:PW.muted, width:28, textAlign:'right', flexShrink:0 }}>{percentage}%</div>}
      </div>
    )
  })
}

function DonutChart({ data, size = 120 }) {
  const entries = Object.entries(data).sort((a,b) => b[1]-a[1])
  const total = entries.reduce((sum, [,v]) => sum + v, 0)
  if (total === 0) return <div style={{ fontSize:12, color:PW.muted, textAlign:'center', padding:20 }}>Sin datos</div>
  
  const colors = [PW.blue, PW.mid, PW.accent, '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6B7280']
  let currentAngle = 0
  
  const segments = entries.map(([key, value], i) => {
    const percentage = (value / total) * 100
    const angle = (value / total) * 360
    const startAngle = currentAngle
    currentAngle += angle
    
    const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180)
    const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180)
    const x2 = 50 + 40 * Math.cos((startAngle + angle - 90) * Math.PI / 180)
    const y2 = 50 + 40 * Math.sin((startAngle + angle - 90) * Math.PI / 180)
    
    const largeArc = angle > 180 ? 1 : 0
    const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`
    
    return { key, value, percentage: Math.round(percentage), color: colors[i % colors.length], path: pathData }
  })
  
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} stroke={PW.white} strokeWidth="1" opacity="0.9" />
        ))}
        <circle cx="50" cy="50" r="20" fill={PW.white} stroke={PW.border} strokeWidth="1" />
        <text x="50" y="46" textAnchor="middle" fontSize="8" fill={PW.text} fontWeight="700">{total}</text>
        <text x="50" y="56" textAnchor="middle" fontSize="5" fill={PW.muted}>TOTAL</text>
      </svg>
      <div style={{ flex:1 }}>
        {segments.slice(0, 6).map(seg => (
          <div key={seg.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <div style={{ width:12, height:12, borderRadius:2, background:seg.color, flexShrink:0 }} />
            <div style={{ fontSize:11, color:PW.text, flex:1, fontWeight:500 }}>{seg.key.replace(/_/g,' ')}</div>
            <div style={{ fontSize:11, color:PW.text, fontWeight:700 }}>{seg.value}</div>
            <div style={{ fontSize:10, color:PW.muted, width:28, textAlign:'right' }}>{seg.percentage}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendChart({ emails }) {
  const last7Days = Array.from({length: 7}, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toISOString().split('T')[0]
  })
  
  const dailyData = last7Days.map(date => {
    const dayEmails = emails.filter(e => e.received_at?.startsWith(date))
    return {
      date,
      count: dayEmails.length,
      pending: dayEmails.filter(e => e.status === 'pendiente').length,
      label: new Date(date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
    }
  })
  
  const maxCount = Math.max(...dailyData.map(d => d.count), 1)
  
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'end', height:80, marginBottom:12, padding:'0 4px' }}>
        {dailyData.map((day, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, height:60, justifyContent:'end' }}>
              {day.count > 0 && (
                <div style={{ width:16, height:`${(day.count/maxCount)*50}px`, background:`linear-gradient(to top, ${PW.blue}, ${PW.mid})`, borderRadius:2, minHeight:4, position:'relative' }}>
                  {day.pending > 0 && <div style={{ position:'absolute', top:0, left:0, right:0, height:`${(day.pending/day.count)*100}%`, background:PW.red, borderRadius:'2px 2px 0 0', minHeight:2 }} />}
                </div>
              )}
              <div style={{ fontSize:9, color:PW.text, fontWeight:700 }}>{day.count}</div>
            </div>
            <div style={{ fontSize:9, color:PW.muted, fontWeight:600, textAlign:'center' }}>{day.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:16, fontSize:9, color:PW.muted }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:8, height:8, background:PW.blue, borderRadius:1 }} />
          <span>Total</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:8, height:8, background:PW.red, borderRadius:1 }} />
          <span>Pendientes</span>
        </div>
      </div>
    </div>
  )
}

function FiltersModal({ open, onClose }) {
  const [subjects, setSubjects] = useState('')
  const [senders, setSenders] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetch(`${API}/filters`)
        .then(res => res.json())
        .then(data => {
          setSubjects(data.exclude_subjects.join(', '))
          setSenders(data.exclude_senders.join(', '))
        })
        .catch(() => {})
    }
  }, [open])

  const saveFilters = async () => {
    setLoading(true)
    try {
      await fetch(`${API}/filters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exclude_subjects: subjects.split(',').map(s => s.trim()).filter(s => s),
          exclude_senders: senders.split(',').map(s => s.trim()).filter(s => s)
        })
      })
      alert('✅ Filtros actualizados correctamente')
      onClose()
    } catch {
      alert('❌ Error al actualizar filtros')
    }
    setLoading(false)
  }

  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,34,102,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <div style={{ background:PW.white, borderRadius:12, width:600, maxWidth:'90vw', boxShadow:'0 12px 40px rgba(0,60,150,0.25)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background:PW.blue, padding:'14px 20px', color:'#fff', fontSize:13, fontWeight:700 }}>🛡️ Filtros de Exclusión</div>
        <div style={{ padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:PW.text, marginBottom:6 }}>Asuntos a excluir (separados por comas):</div>
            <textarea value={subjects} onChange={e => setSubjects(e.target.value)} rows={3} style={{ width:'100%', background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:8, padding:12, fontFamily:'inherit', fontSize:12, color:PW.text, outline:'none', resize:'vertical' }} placeholder="newsletter, boletín, información, marketing..." />
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:PW.text, marginBottom:6 }}>Remitentes a excluir (separados por comas):</div>
            <textarea value={senders} onChange={e => setSenders(e.target.value)} rows={3} style={{ width:'100%', background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:8, padding:12, fontFamily:'inherit', fontSize:12, color:PW.text, outline:'none', resize:'vertical' }} placeholder="noreply, marketing, newsletter, info@..." />
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:7, fontSize:12, fontFamily:'inherit', fontWeight:600, cursor:'pointer', border:`1.5px solid ${PW.border}`, background:PW.white, color:PW.muted }}>Cancelar</button>
            <button onClick={saveFilters} disabled={loading} style={{ padding:'8px 18px', borderRadius:7, fontSize:12, fontFamily:'inherit', fontWeight:700, cursor:'pointer', border:'none', background:PW.blue, color:'#fff' }}>{loading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotesModal({ email, onSave, onClose }) {
  const [text, setText] = useState(email?.notes || '')
  if (!email) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,34,102,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <div style={{ background:PW.white, borderRadius:12, width:480, maxWidth:'90vw', boxShadow:'0 12px 40px rgba(0,60,150,0.25)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background:PW.blue, padding:'14px 20px', color:'#fff', fontSize:13, fontWeight:700 }}>📝 Notas · {email.subject}</div>
        <div style={{ padding:20 }}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5} style={{ width:'100%', background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:8, padding:12, fontFamily:'inherit', fontSize:13, color:PW.text, outline:'none', resize:'vertical', lineHeight:1.6 }} placeholder="Escribí tus notas acá..." />
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14 }}>
            <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:7, fontSize:12, fontFamily:'inherit', fontWeight:600, cursor:'pointer', border:`1.5px solid ${PW.border}`, background:PW.white, color:PW.muted }}>Cancelar</button>
            <button onClick={() => { onSave(email.id, text); onClose() }} style={{ padding:'8px 18px', borderRadius:7, fontSize:12, fontFamily:'inherit', fontWeight:700, cursor:'pointer', border:'none', background:PW.blue, color:'#fff' }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([{ role:'ai', text:'¡Hola! Soy el asistente IA de Payway. Preguntame sobre los correos del backlog.' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role:'user', text:q }])
    setLoading(true)
    try {
      const res = await fetch(`${API}/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ question:q }) })
      const data = await res.json()
      setMessages(m => [...m, { role:'ai', text:data.answer }])
    } catch { setMessages(m => [...m, { role:'ai', text:'Error de conexión.' }]) }
    setLoading(false)
  }

  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return }
    const r = new SR()
    r.lang = 'es-AR'; r.continuous = false; r.interimResults = false
    r.onresult = (e) => { const t = e.results[0][0].transcript; setInput(t); send(t) }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognitionRef.current = r
    r.start()
    setListening(true)
  }

  if (!open) return null
  return (
    <div style={{ position:'fixed', bottom:24, right:24, width:420, maxHeight:'72vh', background:PW.white, borderRadius:14, boxShadow:'0 8px 36px rgba(0,60,150,0.22)', border:`1px solid ${PW.border}`, display:'flex', flexDirection:'column', zIndex:1000, overflow:'hidden' }}>
      <div style={{ background:`linear-gradient(135deg, ${PW.dark}, ${PW.blue})`, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>🤖 Asistente IA</span>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:13, fontWeight:700 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10, maxHeight:'52vh' }}>
        {messages.map((m,i) => (
          <div key={i} style={{ alignSelf:m.role==='user'?'flex-end':'flex-start', maxWidth:'85%', padding:'10px 14px', borderRadius:m.role==='user'?'12px 12px 2px 12px':'12px 12px 12px 2px', background:m.role==='user'?PW.blue:PW.bg, color:m.role==='user'?'#fff':PW.text, fontSize:12, lineHeight:1.6, fontWeight:500, border:m.role==='user'?'none':`1px solid ${PW.border}`, whiteSpace:'pre-wrap' }}>{m.text}</div>
        ))}
        {loading && <div style={{ alignSelf:'flex-start', padding:'10px 14px', borderRadius:12, background:PW.bg, border:`1px solid ${PW.border}`, fontSize:12, color:PW.muted }}>⏳ Pensando...</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:'12px 16px', borderTop:`1px solid ${PW.border}`, display:'flex', gap:8 }}>
        <button onClick={toggleVoice} style={{ background:listening?PW.red:PW.bg, border:`1.5px solid ${listening?PW.red:PW.border}`, color:listening?'#fff':PW.muted, borderRadius:8, width:38, height:38, cursor:'pointer', fontSize:16, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }} title="Hablar">🎤</button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} placeholder="Preguntá o usá el micrófono..." style={{ flex:1, background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:8, padding:'9px 12px', fontFamily:'inherit', fontSize:12, fontWeight:500, color:PW.text, outline:'none' }} />
        <button onClick={() => send()} disabled={loading} style={{ background:PW.blue, border:'none', color:'#fff', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>Enviar</button>
      </div>
    </div>
  )
}

function App() {
  const [emails, setEmails] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({ status:'', category:'', urgency:'', search:'', include_closed:false })
  const [chatOpen, setChatOpen] = useState(false)
  const [notesEmail, setNotesEmail] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k,v]) => {
      if (v !== '' && v !== false) params.set(k, v)
      if (k === 'include_closed' && v === false) params.set(k, 'false')
    })
    const [eRes, sRes] = await Promise.all([fetch(`${API}/emails?${params}`), fetch(`${API}/stats`)])
    setEmails(await eRes.json())
    setStats(await sRes.json())
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const id = setInterval(fetchData, 30000); return () => clearInterval(id) }, [fetchData])

  const updateEmail = async (id, data) => {
    await fetch(`${API}/emails/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
    fetchData()
  }

  const reclassifyEmails = async () => {
    try {
      const res = await fetch(`${API}/emails/reclassify`, { method: 'POST' })
      const data = await res.json()
      alert(`✅ ${data.message}`)
      setTimeout(fetchData, 2000)
    } catch {
      alert('❌ Error al re-clasificar correos')
    }
  }
  
  const checkAIStatus = async () => {
    try {
      const res = await fetch(`${API}/ai-status`)
      const data = await res.json()
      
      let message = '🤖 Estado de la IA:\n\n'
      
      if (!data.gemini_configured) {
        message += '❌ Gemini API no configurada\n'
        message += '• Falta GEMINI_API_KEY en .env\n'
        message += '• Obtené tu API key en: https://aistudio.google.com/app/apikey'
      } else {
        message += `✅ Gemini API configurada (${data.api_key_length} chars)\n`
        message += `📋 Modelo: ${data.gemini_model}\n\n`
        
        if (data.api_test === 'success') {
          message += '✅ Conexión exitosa con Gemini'
        } else if (data.api_test === 'not_configured') {
          message += '❌ API key no configurada'
        } else if (data.api_test === 'connection_error') {
          message += `❌ Error de conexión: ${data.api_response}`
        } else {
          message += `❌ Error API (${data.api_test}): ${data.api_response}`
        }
      }
      
      alert(message)
    } catch {
      alert('❌ Error al verificar estado de IA')
    }
  }
  
  const exportToExcel = async () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k,v]) => {
      if (v !== '' && v !== false) params.set(k, v)
      if (k === 'include_closed' && v === false) params.set(k, 'false')
    })
    
    try {
      const res = await fetch(`${API}/emails/export?${params}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `payway_emails_${new Date().toISOString().slice(0,10)}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('❌ Error al exportar correos')
      }
    } catch {
      alert('❌ Error al exportar correos')
    }
  }
  
  const resetFilters = () => setFilters({ status:'', category:'', urgency:'', search:'', include_closed:false })
  const hasFilters = Object.values(filters).some(v => v)

  const ages = emails.map(e => e.age_hours)
  const avgAge = ages.length ? (ages.reduce((a,b) => a+b, 0) / ages.length).toFixed(1) : 0
  const maxAge = ages.length ? Math.max(...ages) : 0
  const catMap = {}; emails.forEach(e => { catMap[e.category] = (catMap[e.category]||0)+1 })
  const urgMap = {}; emails.forEach(e => { urgMap[e.urgency] = (urgMap[e.urgency]||0)+1 })
  const assignMap = {}; emails.forEach(e => { const k = e.assigned_to || 'Sin asignar'; assignMap[k] = (assignMap[k]||0)+1 })
  const statusMap = {}; emails.forEach(e => { statusMap[e.status] = (statusMap[e.status]||0)+1 })

  const sel = { background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:7, padding:'7px 10px', fontFamily:'inherit', fontSize:11, fontWeight:500, color:PW.text, cursor:'pointer', outline:'none' }
  const inp = { background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:7, padding:'7px 12px', fontFamily:'inherit', fontSize:12, fontWeight:500, color:PW.text, outline:'none' }
  const card = { background:PW.white, border:`1px solid ${PW.border}`, borderRadius:10, padding:20, boxShadow:'0 1px 3px rgba(0,60,150,0.06)' }
  const cardT = { fontSize:11, textTransform:'uppercase', letterSpacing:1, color:PW.muted, fontWeight:700, marginBottom:16, display:'flex', alignItems:'center', gap:8, paddingBottom:12, borderBottom:`1px solid ${PW.bg}` }
  const dot = { width:3, height:14, borderRadius:2, background:PW.blue, flexShrink:0 }

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:PW.bg, minHeight:'100vh', color:PW.text }}>
      {/* HEADER */}
      <div style={{ background:`linear-gradient(135deg, ${PW.dark} 0%, ${PW.blue} 50%, ${PW.mid} 100%)`, padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64, boxShadow:'0 2px 12px rgba(0,60,150,0.35)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, border:'1px solid rgba(255,255,255,0.1)' }}>📧</div>
          <div style={{ width:1, height:32, background:'rgba(255,255,255,0.12)' }} />
          <div>
            <div style={{ color:'#fff', fontSize:16, fontWeight:700, letterSpacing:-0.3 }}>Payway · Email Workflow</div>
            <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:1 }}>Backlog de Correos · MIS Adquirencia</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:500 }}>Auto-sync · IA Clasificación</span>
          <button onClick={() => setFiltersOpen(true)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>🛡️ Filtros</button>
          <button onClick={checkAIStatus} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>🔍 IA Status</button>
          <button onClick={testAIClassification} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.8)', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>🧪 Test IA</button>
          <button onClick={reclassifyEmails} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.8)', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Re-clasificar</button>
          <button onClick={() => setChatOpen(o => !o)} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>🤖 Asistente IA</button>
        </div>
      </div>

      {/* SUB-HEADER */}
      <div style={{ background:PW.white, padding:'12px 32px', borderBottom:`1px solid ${PW.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:12, color:PW.muted }}>MIS Adquirencia <span style={{ color:PW.border, margin:'0 6px' }}>›</span> <b style={{ color:PW.text }}>Email Workflow</b> <span style={{ color:PW.border, margin:'0 6px' }}>›</span> Backlog <span style={{ marginLeft:8, fontSize:11 }}>· {new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}</span></div>
        <div style={{ background:PW.bg, border:`1.5px solid ${PW.border}`, borderRadius:6, padding:'5px 14px', fontSize:12, color:PW.text, fontWeight:500 }}>TOTAL <b style={{ color:PW.blue, fontWeight:800 }}>{stats?.total || 0}</b> correos</div>
      </div>

      <div style={{ padding:'24px 32px' }}>
        {/* FILTERS */}
        <div style={{ background:PW.white, border:`1px solid ${PW.border}`, borderRadius:10, padding:'16px 20px', marginBottom:20, display:'flex', flexWrap:'wrap', gap:16, alignItems:'flex-end', boxShadow:'0 1px 3px rgba(0,60,150,0.06)' }}>
          <div>
            <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:1, color:PW.muted, fontWeight:600, marginBottom:5 }}>Buscar</div>
            <input style={{...inp, width:220}} placeholder="🔍 asunto, remitente..." value={filters.search} onChange={e => setFilters(f => ({...f, search:e.target.value}))} />
          </div>
          {[
            { key:'status', label:'Estado', opts:STATUSES, labels:SL },
            { key:'urgency', label:'Urgencia', opts:['critica','alta','media','baja'] },
            { key:'category', label:'Categoría', opts:['consulta_comercial','soporte_tecnico','reclamo','facturacion','integracion_api','fraude_seguridad','operaciones','regulatorio','interno','otro','sin_categorizar'] },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:1, color:PW.muted, fontWeight:600, marginBottom:5 }}>{f.label}</div>
              <select style={sel} value={filters[f.key]} onChange={e => setFilters(prev => ({...prev, [f.key]:e.target.value}))}>
                <option value="">Todos</option>
                {f.opts.map(o => <option key={o} value={o}>{(f.labels?.[o] || o).replace(/_/g,' ')}</option>)}
              </select>
            </div>
          ))}
          <div>
            <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:1, color:PW.muted, fontWeight:600, marginBottom:5 }}>Cerrados</div>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 12px', background:filters.include_closed?`${PW.blue}15`:PW.bg, border:`1.5px solid ${filters.include_closed?PW.blue:PW.border}`, borderRadius:7, fontSize:11, fontWeight:500, color:filters.include_closed?PW.blue:PW.text, transition:'all 0.2s ease' }}>
              <input type="checkbox" checked={filters.include_closed} onChange={e => setFilters(prev => ({...prev, include_closed:e.target.checked}))} style={{ margin:0, accentColor:PW.blue }} />
              Mostrar cerrados
            </label>
          </div>
          {hasFilters && <button onClick={resetFilters} style={{ padding:'7px 12px', borderRadius:7, fontSize:11, fontFamily:'inherit', fontWeight:600, cursor:'pointer', border:`1.5px dashed ${PW.border}`, background:'transparent', color:PW.muted }}>✕ Limpiar</button>}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, fontSize:11, color:PW.muted, fontWeight:500 }}>
          <b style={{ color:PW.text }}>{emails.length}</b> / {stats?.total||0} correos {hasFilters && <span style={{ color:PW.mid }}>· filtros activos</span>}
          <button onClick={exportToExcel} style={{ marginLeft:'auto', background:PW.accent, border:'none', color:'#fff', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
            📄 Exportar Excel
          </button>
        </div>

        {/* KPIs */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:24 }}>
            {[
              { label:'Total Filtrado', value:emails.length, sub:'correos activos', accent:false, icon:'📊' },
              { label:'Pendientes', value:statusMap.pendiente||0, sub:`${emails.length?((statusMap.pendiente||0)/emails.length*100).toFixed(0):0}% del filtro`, accent:statusMap.pendiente > 5, icon:'⏳' },
              { label:'En Proceso', value:statusMap.en_proceso||0, sub:'en seguimiento', accent:false, icon:'🔄' },
              { label:'Resueltos Hoy', value:emails.filter(e => e.status === 'respondido' && e.age_hours < 24).length, sub:'últimas 24h', accent:false, icon:'✅' },
              { label:'Antigüedad Prom.', value:`${avgAge}h`, sub:'tiempo en backlog', accent:avgAge > 24, icon:'⏱️' },
              { label:'Críticos', value:urgMap.critica||0, sub:'requieren atención', accent:(urgMap.critica||0) > 0, icon:'🚨' },
            ].map((k,i) => (
              <div key={i} style={{ background:PW.white, border:`1px solid ${PW.border}`, borderRadius:12, padding:'20px 18px', borderTop:`4px solid ${k.accent?PW.red:PW.blue}`, boxShadow:'0 2px 8px rgba(0,60,150,0.08)', transition:'transform 0.2s ease', cursor:'default' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:10, color:PW.muted, textTransform:'uppercase', letterSpacing:1, fontWeight:700 }}>{k.label}</div>
                  <span style={{ fontSize:16, opacity:0.7 }}>{k.icon}</span>
                </div>
                <div style={{ fontSize:28, fontWeight:800, lineHeight:1, letterSpacing:-0.5, color:k.accent?PW.red:PW.blue, marginBottom:6 }}>{k.value}</div>
                <div style={{ fontSize:11, color:PW.muted, fontWeight:500 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* CHARTS */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16, marginBottom:20 }}>
          <div style={{...card, padding:24}}>
            <div style={cardT}><div style={dot} />Categoría (IA)</div>
            {Object.keys(catMap).length ? <BarChart data={catMap} showPercentage={true} /> : <div style={{ fontSize:12, color:PW.muted, textAlign:'center', padding:20 }}>Sin datos</div>}
          </div>
          <div style={{...card, padding:24}}>
            <div style={cardT}><div style={dot} />Urgencia (IA)</div>
            {Object.keys(urgMap).length ? <DonutChart data={urgMap} size={140} /> : <div style={{ fontSize:12, color:PW.muted, textAlign:'center', padding:20 }}>Sin datos</div>}
          </div>
          <div style={{...card, padding:24}}>
            <div style={cardT}><div style={dot} />Carga por Asignado</div>
            {Object.keys(assignMap).length ? <BarChart data={assignMap} showPercentage={true} /> : <div style={{ fontSize:12, color:PW.muted, textAlign:'center', padding:20 }}>Sin datos</div>}
            {(assignMap['Sin asignar']||0) > 0 && (
              <div style={{ background:`${PW.red}08`, border:`1px solid ${PW.red}20`, borderRadius:8, padding:'12px 16px', marginTop:16, fontSize:11, color:PW.text, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <span><b style={{ color:PW.red, fontWeight:700 }}>{assignMap['Sin asignar']}</b> correo{assignMap['Sin asignar']>1?'s':''} sin responsable</span>
              </div>
            )}
          </div>
          <div style={{...card, padding:24}}>
            <div style={cardT}><div style={dot} />Tendencia (7 días)</div>
            <TrendChart emails={emails} />
          </div>
        </div>

        {/* TABLE */}
        <div style={{...card, marginBottom:0, padding:0}}>
          <div style={{...cardT, justifyContent:'space-between', margin:'20px 20px 0 20px', paddingBottom:16}}>
            <span style={{ display:'flex', alignItems:'center', gap:8 }}><div style={dot} />Detalle de Correos</span>
            <span style={{ fontSize:10, color:PW.muted, fontWeight:600 }}>{emails.length} fila{emails.length!==1?'s':''} {!filters.include_closed && <span style={{color:PW.blue}}>· cerrados ocultos</span>}</span>
          </div>
          <div style={{ overflowX:'auto', borderRadius:'0 0 10px 10px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:`linear-gradient(135deg, ${PW.bg}, ${PW.bg2})`, borderTop:`1px solid ${PW.border}` }}>
                {['Antig.','Asunto','Resumen IA','Remitente','Categoría','Urgencia','Estado','Asignado','Notas'].map(h =>
                  <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:PW.text, borderBottom:`2px solid ${PW.border}`, padding:'14px 16px', whiteSpace:'nowrap', position:'sticky', top:0, background:`linear-gradient(135deg, ${PW.bg}, ${PW.bg2})`, zIndex:10 }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {emails.map((e, index) => (
                  <tr key={e.id} style={{ 
                    background: e.age_hours > 48 && e.status === 'pendiente' ? `${PW.red}08` : 
                               e.age_hours > 24 && e.status === 'pendiente' ? `${PW.blue}08` : 
                               index % 2 === 0 ? PW.white : `${PW.bg}40`,
                    borderLeft: e.age_hours > 48 && e.status === 'pendiente' ? `4px solid ${PW.red}` : 
                               e.age_hours > 24 && e.status === 'pendiente' ? `4px solid ${PW.blue}` : '4px solid transparent',
                    transition: 'all 0.2s ease'
                  }} onMouseEnter={ev => ev.target.style.background = PW.light} onMouseLeave={ev => ev.target.style.background = e.age_hours > 48 && e.status === 'pendiente' ? `${PW.red}08` : e.age_hours > 24 && e.status === 'pendiente' ? `${PW.blue}08` : index % 2 === 0 ? PW.white : `${PW.bg}40`}>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, verticalAlign:'middle' }}>{ageBadge(e.age_hours)}</td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600, color:PW.text, verticalAlign:'middle' }} title={e.body_preview}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:3, height:16, borderRadius:2, background: e.urgency === 'critica' ? PW.red : e.urgency === 'alta' ? '#F59E0B' : PW.blue, flexShrink:0 }} />
                        {e.subject}
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11, color:PW.mid, fontStyle:'italic', verticalAlign:'middle' }} title={e.summary}>
                      {e.summary ? (
                        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ color:'#10B981', fontSize:12 }}>✓</span>
                          {e.summary}
                        </span>
                      ) : (
                        <span style={{ display:'flex', alignItems:'center', gap:6, color:PW.muted }}>
                          <span style={{ fontSize:12 }}>⏳</span>
                          clasificando...
                        </span>
                      )}
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, whiteSpace:'nowrap', fontWeight:500, color:PW.text, verticalAlign:'middle' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background:`linear-gradient(135deg, ${PW.blue}, ${PW.mid})`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10, fontWeight:700, flexShrink:0 }}>
                          {e.sender.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize:11 }}>{e.sender}</span>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, verticalAlign:'middle' }}>
                      <select value={e.category} onChange={ev => updateEmail(e.id, { category:ev.target.value })} style={{...sel, fontSize:11, padding:'6px 10px', minWidth:140, background:PW.white}}>
                        {['consulta_comercial','soporte_tecnico','reclamo','facturacion','integracion_api','fraude_seguridad','operaciones','regulatorio','interno','otro','sin_categorizar'].map(cat => 
                          <option key={cat} value={cat}>{cat.replace(/_/g,' ')}</option>
                        )}
                      </select>
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, verticalAlign:'middle' }}>
                      <select value={e.urgency} onChange={ev => updateEmail(e.id, { urgency:ev.target.value })} style={{...sel, fontSize:11, padding:'6px 10px', minWidth:100, background:PW.white}}>
                        {['critica','alta','media','baja'].map(urg => 
                          <option key={urg} value={urg}>{urg}</option>
                        )}
                      </select>
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, verticalAlign:'middle' }}>
                      <select value={e.status} onChange={ev => updateEmail(e.id, { status:ev.target.value })} style={{...sel, fontSize:11, padding:'6px 10px', minWidth:120}}>
                        {STATUSES.map(s => <option key={s} value={s}>{SI[s]} {SL[s]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, verticalAlign:'middle' }}>
                      <input defaultValue={e.assigned_to||''} placeholder="Asignar..." onBlur={ev => { if (ev.target.value !== (e.assigned_to||'')) updateEmail(e.id, { assigned_to:ev.target.value }) }} style={{...inp, width:130, fontSize:11, padding:'8px 12px'}} />
                    </td>
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${PW.bg2}`, textAlign:'center', verticalAlign:'middle' }}>
                      <button onClick={() => setNotesEmail(e)} style={{ background:e.notes?`${PW.blue}15`:'transparent', border:e.notes?`1px solid ${PW.blue}30`:`1px solid ${PW.border}`, borderRadius:8, cursor:'pointer', fontSize:14, padding:'8px 12px', color:e.notes?PW.blue:PW.muted, transition:'all 0.2s ease' }} title={e.notes||'Agregar nota'}>
                        {e.notes ? '📝' : '➕'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {emails.length === 0 && <div style={{ textAlign:'center', padding:'48px 20px', color:PW.muted, fontSize:13 }}><div style={{ fontSize:32, marginBottom:12 }}>📭</div>No hay correos que coincidan con los filtros.</div>}
          </div>
        </div>
      </div>

      {!chatOpen && <button onClick={() => setChatOpen(true)} style={{ position:'fixed', bottom:24, right:24, width:56, height:56, borderRadius:'50%', background:`linear-gradient(135deg, ${PW.dark}, ${PW.mid})`, border:'none', color:'#fff', fontSize:24, cursor:'pointer', boxShadow:'0 4px 20px rgba(0,60,150,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>🤖</button>}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <NotesModal email={notesEmail} onSave={(id, notes) => updateEmail(id, { notes })} onClose={() => setNotesEmail(null)} />
      <FiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}

export default App

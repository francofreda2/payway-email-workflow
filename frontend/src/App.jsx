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

function BarChart({ data, max: maxOverride }) {
  const entries = Object.entries(data).sort((a,b) => b[1]-a[1])
  const max = maxOverride || Math.max(...entries.map(e => e[1]), 1)
  return entries.map(([k,v]) => (
    <div key={k} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
      <div style={{ fontSize:11, color:PW.text, width:110, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:500 }} title={k}>{k.replace(/_/g,' ')}</div>
      <div style={{ flex:1, background:PW.bg, borderRadius:3, height:7, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:3, width:`${v/max*100}%`, background:PW.blue, transition:'width .8s cubic-bezier(.16,1,.3,1)' }} />
      </div>
      <div style={{ fontSize:11, color:PW.text, width:26, textAlign:'right', flexShrink:0, fontWeight:700 }}>{v}</div>
    </div>
  ))
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
  const [filters, setFilters] = useState({ status:'', category:'', urgency:'', search:'' })
  const [chatOpen, setChatOpen] = useState(false)
  const [notesEmail, setNotesEmail] = useState(null)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)))
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

  const resetFilters = () => setFilters({ status:'', category:'', urgency:'', search:'' })
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
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:500 }}>Auto-sync · Gemini IA</span>
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
          {hasFilters && <button onClick={resetFilters} style={{ padding:'7px 12px', borderRadius:7, fontSize:11, fontFamily:'inherit', fontWeight:600, cursor:'pointer', border:`1.5px dashed ${PW.border}`, background:'transparent', color:PW.muted }}>✕ Limpiar</button>}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, fontSize:11, color:PW.muted, fontWeight:500 }}>
          <b style={{ color:PW.text }}>{emails.length}</b> / {stats?.total||0} correos {hasFilters && <span style={{ color:PW.mid }}>· filtros activos</span>}
        </div>

        {/* KPIs */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Total Filtrado', value:emails.length, sub:'correos', accent:false },
              { label:'Pendientes', value:statusMap.pendiente||0, sub:`${emails.length?((statusMap.pendiente||0)/emails.length*100).toFixed(0):0}% del filtro`, accent:false },
              { label:'En Proceso', value:statusMap.en_proceso||0, sub:'en seguimiento', accent:false },
              { label:'Antigüedad Prom.', value:`${avgAge}h`, sub:'horas en backlog', accent:false },
              { label:'Máx. Antigüedad', value:`${maxAge}h`, sub:'correo más antiguo', accent:true },
            ].map((k,i) => (
              <div key={i} style={{ background:PW.white, border:`1px solid ${PW.border}`, borderRadius:10, padding:'18px 20px', borderTop:`3px solid ${k.accent?PW.red:PW.blue}`, boxShadow:'0 1px 3px rgba(0,60,150,0.06)' }}>
                <div style={{ fontSize:10, color:PW.muted, textTransform:'uppercase', letterSpacing:1, fontWeight:600, marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:32, fontWeight:800, lineHeight:1, letterSpacing:-1, color:k.accent?PW.red:PW.blue }}>{k.value}</div>
                <div style={{ fontSize:11, color:PW.muted, marginTop:5, fontWeight:500 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* CHARTS */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
          <div style={card}><div style={cardT}><div style={dot} />Categoría (IA)</div>{Object.keys(catMap).length ? <BarChart data={catMap} /> : <div style={{ fontSize:12, color:PW.muted }}>Sin datos</div>}</div>
          <div style={card}><div style={cardT}><div style={dot} />Urgencia (IA)</div>{Object.keys(urgMap).length ? <BarChart data={urgMap} /> : <div style={{ fontSize:12, color:PW.muted }}>Sin datos</div>}</div>
          <div style={card}>
            <div style={cardT}><div style={dot} />Carga por Asignado</div>
            {Object.keys(assignMap).length ? <BarChart data={assignMap} /> : <div style={{ fontSize:12, color:PW.muted }}>Sin datos</div>}
            {(assignMap['Sin asignar']||0) > 0 && <div style={{ background:PW.light, border:`1px solid ${PW.border}`, borderRadius:7, padding:'10px 14px', marginTop:12, fontSize:11, color:PW.text }}><b style={{ color:PW.blue }}>⚠ {assignMap['Sin asignar']}</b> correo{assignMap['Sin asignar']>1?'s':''} sin responsable</div>}
          </div>
        </div>

        {/* TABLE */}
        <div style={{...card, marginBottom:0}}>
          <div style={{...cardT, justifyContent:'space-between'}}>
            <span style={{ display:'flex', alignItems:'center', gap:8 }}><div style={dot} />Detalle de Correos</span>
            <span style={{ fontSize:10, color:PW.muted, fontWeight:600 }}>{emails.length} fila{emails.length!==1?'s':''}</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>
                {['Antig.','Asunto','Resumen IA','Remitente','Categoría','Urgencia','Estado','Asignado','Notas'].map(h =>
                  <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:PW.muted, borderBottom:`2px solid ${PW.border}`, padding:'8px 10px', background:PW.bg, whiteSpace:'nowrap' }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {emails.map(e => (
                  <tr key={e.id} style={{ background: e.age_hours > 24 && e.status === 'pendiente' ? PW.light : 'transparent' }}>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}` }}>{ageBadge(e.age_hours)}</td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}`, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600 }} title={e.body_preview}>{e.subject}</td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}`, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11, color:PW.mid, fontStyle:'italic' }} title={e.summary}>{e.summary || '⏳ clasificando...'}</td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}`, whiteSpace:'nowrap', fontWeight:500 }}>{e.sender}</td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}` }}><span style={tag()}>{(e.category||'').replace(/_/g,' ')}</span></td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}` }}><span style={urgStyle(e.urgency)}>{e.urgency}</span></td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}` }}>
                      <select value={e.status} onChange={ev => updateEmail(e.id, { status:ev.target.value })} style={{...sel, fontSize:11, padding:'4px 8px'}}>
                        {STATUSES.map(s => <option key={s} value={s}>{SI[s]} {SL[s]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}` }}>
                      <input defaultValue={e.assigned_to||''} placeholder="Asignar..." onBlur={ev => { if (ev.target.value !== (e.assigned_to||'')) updateEmail(e.id, { assigned_to:ev.target.value }) }} style={{...inp, width:100, fontSize:11, padding:'4px 8px'}} />
                    </td>
                    <td style={{ padding:'10px', borderBottom:`1px solid ${PW.bg}` }}>
                      <button onClick={() => setNotesEmail(e)} style={{ background:e.notes?PW.light:'none', border:e.notes?`1px solid ${PW.border}`:'none', borderRadius:6, cursor:'pointer', fontSize:14, padding:'2px 6px' }} title={e.notes||'Agregar nota'}>{e.notes ? '📝' : '➕'}</button>
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
    </div>
  )
}

export default App

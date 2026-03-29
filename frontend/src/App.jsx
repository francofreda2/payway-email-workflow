import React, { useState, useEffect, useCallback } from 'react'

const API = '/api'
const URGENCY_COLORS = { critica: '#dc2626', alta: '#ea580c', media: '#ca8a04', baja: '#16a34a' }
const STATUS_LABELS = { pendiente: '⏳ Pendiente', en_proceso: '🔄 En Proceso', respondido: '✅ Respondido', cerrado: '📁 Cerrado' }

function App() {
  const [emails, setEmails] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({ status: '', category: '', urgency: '', search: '' })
  const fetchData = useCallback(async () => {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
    const [emailsRes, statsRes] = await Promise.all([
      fetch(`${API}/emails?${params}`), fetch(`${API}/stats`)
    ])
    setEmails(await emailsRes.json())
    setStats(await statsRes.json())
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const id = setInterval(fetchData, 30000); return () => clearInterval(id) }, [fetchData])

  const updateEmail = async (id, data) => {
    await fetch(`${API}/emails/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
    fetchData()
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 1400, margin: '0 auto', padding: 20, background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>📧 Payway Email Workflow</h1>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>🔄 Auto-sync vía Power Automate</span>
      </header>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total', value: stats.total, color: '#475569' },
            { label: 'Pendientes', value: stats.pendiente, color: '#dc2626' },
            { label: 'En Proceso', value: stats.en_proceso, color: '#ea580c' },
            { label: 'Respondidos', value: stats.respondido, color: '#16a34a' },
            { label: 'Antigüedad Prom.', value: `${stats.avg_age_hours}h`, color: '#7c3aed' },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', padding: 16, borderRadius: 12, borderLeft: `4px solid ${c.color}`, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar..." value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 200 }} />
        {[
          { key: 'status', opts: ['', 'pendiente', 'en_proceso', 'respondido', 'cerrado'], label: 'Estado' },
          { key: 'urgency', opts: ['', 'critica', 'alta', 'media', 'baja'], label: 'Urgencia' },
          { key: 'category', opts: ['', 'consulta_comercial', 'soporte_tecnico', 'reclamo', 'facturacion', 'integracion_api', 'fraude_seguridad', 'operaciones', 'regulatorio', 'interno'], label: 'Categoría' },
        ].map(f => (
          <select key={f.key} value={filters[f.key]} onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <option value="">{f.label}: Todos</option>
            {f.opts.filter(Boolean).map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              {['Antigüedad', 'Asunto', 'Remitente', 'Categoría', 'Urgencia', 'Estado', 'Asignado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#475569' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {emails.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #e2e8f0', background: e.age_hours > 24 && e.status === 'pendiente' ? '#fef2f2' : 'transparent' }}>
                <td style={{ padding: '10px 12px', fontWeight: e.age_hours > 24 ? 700 : 400, color: e.age_hours > 48 ? '#dc2626' : e.age_hours > 24 ? '#ea580c' : '#475569' }}>
                  {e.age_hours}h
                </td>
                <td style={{ padding: '10px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={e.body_preview}>{e.subject}</td>
                <td style={{ padding: '10px 12px' }}>{e.sender}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                    {e.category?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ color: URGENCY_COLORS[e.urgency] || '#475569', fontWeight: 600 }}>
                    {e.urgency}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <select value={e.status} onChange={ev => updateEmail(e.id, { status: ev.target.value })}
                    style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12 }}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <input value={e.assigned_to || ''} placeholder="Asignar..."
                    onBlur={ev => updateEmail(e.id, { assigned_to: ev.target.value })}
                    style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', width: 90, fontSize: 12 }} />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => { const n = prompt('Notas:', e.notes || ''); if (n !== null) updateEmail(e.id, { notes: n }) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} title="Agregar nota">📝</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {emails.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay correos para mostrar</div>}
      </div>
    </div>
  )
}

export default App

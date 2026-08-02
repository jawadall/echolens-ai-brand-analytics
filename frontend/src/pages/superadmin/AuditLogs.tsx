import { useState, useEffect } from 'react'
import { adminAPI } from '../../api/client'

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => { adminAPI.getAuditLogs().then(r => setLogs(r.data.logs || [])).catch(() => {}) }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Audit Logs</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track all administrative actions</p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{logs.length} entries</p>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>No audit logs yet</div>
          ) : logs.map(l => (
            <div key={l.id} className="px-5 py-3 text-sm transition-colors hover:opacity-80" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{l.action}</span>
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{l.description}</span>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(l.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>by {l.user} — target: {l.target}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

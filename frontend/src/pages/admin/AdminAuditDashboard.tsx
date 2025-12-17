import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

type AuditItem = {
  contract: { id: string; status?: string };
  landlord?: { id: string; email?: string };
  tenant?: { id: string; email?: string };
  type: string;
  status: string;
  date?: string;
  hash?: string | null;
  auditPdfUrl?: string;
  envelopeId?: string;
};

const STATUS_LABELS: Record<string, string> = {
  created: 'Pendiente',
  sent: 'Enviado',
  completed: 'Firmado',
  declined: 'Rechazado',
  error: 'Error',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  completed: { bg: '#dcfce7', color: '#166534' },
  sent: { bg: '#dbeafe', color: '#1d4ed8' },
  created: { bg: '#f3f4f6', color: '#374151' },
  declined: { bg: '#fee2e2', color: '#991b1b' },
  error: { bg: '#fee2e2', color: '#991b1b' },
};

export default function AdminAuditDashboard() {
  const [data, setData] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Todos' },
      { value: 'created', label: 'Pendiente' },
      { value: 'sent', label: 'Enviado' },
      { value: 'completed', label: 'Firmado' },
      { value: 'declined', label: 'Rechazado' },
      { value: 'error', label: 'Error' },
    ],
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (userId) params.userId = userId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (status) params.status = status;
      const res = await axios.get('/api/admin/compliance/audit-trails', { params });
      setData(res.data?.data || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar audit trails');
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Audit Trails (Firma)</h2>
        <Link to="/admin/compliance" className="px-3 py-1.5 rounded border border-gray-300">
          Volver a Compliance
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label>User ID:</label>
          <input value={userId} onChange={e => setUserId(e.target.value)} style={{ marginLeft: 8 }} placeholder="userId" />
        </div>
        <div>
          <label>Desde:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ marginLeft: 8 }} />
        </div>
        <div>
          <label>Hasta:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ marginLeft: 8 }} />
        </div>
        <div>
          <label>Estado:</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ marginLeft: 8 }}>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button onClick={fetchData}>Refrescar</button>
      </div>

      {loading && <p>Cargando audit trails...</p>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {!loading && data.length === 0 && <p>No hay registros.</p>}

      {data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cell}>Contrato</th>
                <th style={cell}>Propietario</th>
                <th style={cell}>Inquilino</th>
                <th style={cell}>Estado firma</th>
                <th style={cell}>Fecha</th>
                <th style={cell}>Hash</th>
                <th style={cell}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const badge = STATUS_BADGE[row.status] || { bg: '#f3f4f6', color: '#374151' };
                const label = STATUS_LABELS[row.status] || row.status;
                return (
                  <tr key={`${row.contract.id}-${idx}`} style={{ background: idx % 2 ? '#f9fafb' : 'white' }}>
                    <td style={cell}>{row.contract.id}</td>
                    <td style={cell}>{row.landlord?.email || row.landlord?.id || '-'}</td>
                    <td style={cell}>{row.tenant?.email || row.tenant?.id || '-'}</td>
                    <td style={cell}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>
                        {label}
                      </span>
                    </td>
                    <td style={cell}>{row.date ? new Date(row.date).toLocaleString() : '-'}</td>
                    <td style={cell}>
                      <code style={{ fontSize: 12 }}>{row.hash ? String(row.hash).slice(0, 12) + '…' : '-'}</code>
                    </td>
                    <td style={cell}>
                      {row.auditPdfUrl ? (
                        <button onClick={() => window.open(row.auditPdfUrl!, '_blank')}>Descargar</button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const cell: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  padding: '8px',
  textAlign: 'left',
  fontSize: 14,
};


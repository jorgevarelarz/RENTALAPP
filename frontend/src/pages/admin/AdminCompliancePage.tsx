import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

type Acceptance = {
  user: { id: string; email: string };
  policyType: string;
  policyVersion: string;
  acceptedAt: string;
  ip?: string;
  userAgent?: string;
};

const typeLabels: Record<string, string> = {
  privacy_policy: 'Privacidad',
  terms_of_service: 'Términos de Servicio',
  data_processing: 'Datos',
};

const policyOptions = [
  { value: '', label: 'Todas' },
  { value: 'privacy_policy', label: 'Privacidad' },
  { value: 'terms_of_service', label: 'Términos de Servicio' },
  { value: 'data_processing', label: 'Datos' },
];

export default function AdminCompliancePage() {
  const [data, setData] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyType, setPolicyType] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (policyType) params.policyType = policyType;
      if (activeOnly) params.activeOnly = true;
      const res = await axios.get('/api/admin/policies/acceptances', { params });
      setData(res.data?.data || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar aceptaciones');
    } finally {
      setLoading(false);
    }
  }, [policyType, activeOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCSV = () => {
    const header = ['userId', 'email', 'policyType', 'policyVersion', 'acceptedAt', 'ip', 'userAgent'];
    const rows = data.map(d => [
      d.user.id,
      d.user.email,
      d.policyType,
      d.policyVersion,
      d.acceptedAt,
      d.ip || '',
      (d.userAgent || '').replace(/,/g, ';'),
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'policy-acceptances.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label>Política:</label>
          <select value={policyType} onChange={e => setPolicyType(e.target.value)} style={{ marginLeft: 8 }}>
            {policyOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Solo versiones vigentes
        </label>
        <button onClick={fetchData}>Refrescar</button>
        <button onClick={exportCSV}>Exportar CSV</button>
      </div>

      {loading && <p>Cargando aceptaciones...</p>}
      {error && (
        <div style={{ color: 'red' }}>
          Error: {error}
        </div>
      )}

      {!loading && data.length === 0 && <p>No hay aceptaciones registradas.</p>}

      {data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cell}>Usuario</th>
                <th style={cell}>Email</th>
                <th style={cell}>Política</th>
                <th style={cell}>Versión</th>
                <th style={cell}>Fecha</th>
                <th style={cell}>IP</th>
                <th style={cell}>UserAgent</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, idx) => (
                <tr key={idx} style={{ background: idx % 2 ? '#f9fafb' : 'white' }}>
                  <td style={cell}>{a.user.id}</td>
                  <td style={cell}>{a.user.email}</td>
                  <td style={cell}>{typeLabels[a.policyType] || a.policyType}</td>
                  <td style={cell}>{a.policyVersion}</td>
                  <td style={cell}>{new Date(a.acceptedAt).toLocaleString()}</td>
                  <td style={cell}>{a.ip || '-'}</td>
                  <td style={cell}>{a.userAgent || '-'}</td>
                </tr>
              ))}
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

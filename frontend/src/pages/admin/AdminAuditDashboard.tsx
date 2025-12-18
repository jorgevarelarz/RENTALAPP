import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import toast from 'react-hot-toast';

type AuditItem = {
  contractId: string;
  user: { name?: string; email?: string } | null;
  status: string;
  lastEvent?: string;
  auditHash?: string | null;
  auditPdfUrl?: string;
};

type AuditMeta = { total: number; page: number; pageSize: number };
type AuditStats = { completed: number; sent: number; declined: number; error: number; created: number; other: number };

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
  const { token } = useAuth();
  const [data, setData] = useState<AuditItem[]>([]);
  const [meta, setMeta] = useState<AuditMeta>({ total: 0, page: 1, pageSize: 25 });
  const [stats, setStats] = useState<AuditStats>({ completed: 0, sent: 0, declined: 0, error: 0, created: 0, other: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const lastSseRefreshAtRef = useRef<number>(0);

  const debouncedUserId = useDebouncedValue(userId, 400);
  const debouncedDateFrom = useDebouncedValue(dateFrom, 400);
  const debouncedDateTo = useDebouncedValue(dateTo, 400);
  const debouncedStatus = useDebouncedValue(status, 400);

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
      if (debouncedUserId) params.userId = debouncedUserId;
      if (debouncedDateFrom) params.dateFrom = debouncedDateFrom;
      if (debouncedDateTo) params.dateTo = debouncedDateTo;
      if (debouncedStatus) params.status = debouncedStatus;
      params.page = meta.page;
      params.pageSize = meta.pageSize;
      const res = await axios.get('/api/admin/compliance/audit-trails', { params });
      setData(res.data?.data || []);
      setMeta(res.data?.meta || { total: 0, page: meta.page, pageSize: meta.pageSize });
      setStats(res.data?.stats || { completed: 0, sent: 0, declined: 0, error: 0, created: 0, other: 0 });
    } catch (err: any) {
      setError(err?.message || 'Error al cargar audit trails');
    } finally {
      setLoading(false);
    }
  }, [debouncedUserId, debouncedDateFrom, debouncedDateTo, debouncedStatus, meta.page, meta.pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setMeta(m => ({ ...m, page: 1 }));
  }, [debouncedUserId, debouncedDateFrom, debouncedDateTo, debouncedStatus]);

  useEffect(() => {
    if (!token) return;
    const url = `/api/admin/compliance/audit-trails/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    const onUpdate = () => {
      const now = Date.now();
      if (now - lastSseRefreshAtRef.current < 2000) return;
      lastSseRefreshAtRef.current = now;
      fetchData();
    };
    es.addEventListener('auditTrailUpdated', onUpdate);
    return () => {
      es.removeEventListener('auditTrailUpdated', onUpdate as any);
      es.close();
    };
  }, [token, fetchData]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.pageSize || 25)));

  const exportCsv = async () => {
    const params: any = { format: 'csv' };
    if (debouncedUserId) params.userId = debouncedUserId;
    if (debouncedDateFrom) params.dateFrom = debouncedDateFrom;
    if (debouncedDateTo) params.dateTo = debouncedDateTo;
    if (debouncedStatus) params.status = debouncedStatus;
    const res = await axios.get('/api/admin/compliance/audit-trails', { params, responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-trails.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelected = (id: string) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAllOnPage = () => {
    const next: Record<string, boolean> = {};
    for (const row of data) next[row.contractId] = true;
    setSelected(prev => ({ ...prev, ...next }));
  };

  const clearSelection = () => setSelected({});

  const openSelectedPdfs = () => {
    const selectedIds = Object.keys(selected).filter(k => selected[k]);
    const urls = data.filter(d => selectedIds.includes(d.contractId)).map(d => d.auditPdfUrl).filter(Boolean) as string[];
    for (const u of urls) window.open(u, '_blank');
  };

  const exportZip = async () => {
    const selectedIds = Object.keys(selected).filter(k => selected[k]);
    if (selectedIds.length === 0) {
      toast.error('Selecciona al menos un contrato');
      return;
    }

    const toastId = 'zip-export';
    let progressValue = 0;
    const renderToast = () =>
      toast.custom(
        () => (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', padding: 12, borderRadius: 12, width: 320 }}>
            <div style={{ fontWeight: 700 }}>Exportando ZIP…</div>
            <div style={{ marginTop: 8, height: 8, background: '#f3f4f6', borderRadius: 999 }}>
              <div style={{ height: 8, width: `${progressValue}%`, background: '#1d4ed8', borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{progressValue}%</div>
          </div>
        ),
        { id: toastId, duration: Infinity },
      );

    renderToast();
    try {
      const res = await axios.get('/api/admin/compliance/audit-trails/export', {
        params: { format: 'zip', contractIds: selectedIds.join(',') },
        responseType: 'blob',
        onDownloadProgress: (evt: any) => {
          if (evt.total) {
            progressValue = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
            renderToast();
          }
        },
      });
      toast.dismiss(toastId);
      toast.success('ZIP descargado');
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-trails.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'Error exportando ZIP');
    }
  };

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
        <button onClick={exportCsv}>Exportar CSV</button>
        <button onClick={exportZip} disabled={Object.keys(selected).filter(k => selected[k]).length === 0}>
          Exportar ZIP
        </button>
        <button onClick={selectAllOnPage} disabled={data.length === 0}>Seleccionar página</button>
        <button onClick={clearSelection} disabled={Object.keys(selected).length === 0}>Limpiar selección</button>
        <button onClick={openSelectedPdfs} disabled={Object.keys(selected).filter(k => selected[k]).length === 0}>
          Abrir PDFs seleccionados
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <StatCard label="Firmados" value={stats.completed} color="#166534" />
        <StatCard label="Pendientes" value={stats.sent + stats.created} color="#1d4ed8" />
        <StatCard label="Rechazados/Error" value={stats.declined + stats.error} color="#991b1b" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button disabled={meta.page <= 1} onClick={() => setMeta(m => ({ ...m, page: Math.max(1, m.page - 1) }))}>
          Anterior
        </button>
        <span>
          Página {meta.page} / {totalPages} — Total {meta.total}
        </span>
        <button
          disabled={meta.page >= totalPages}
          onClick={() => setMeta(m => ({ ...m, page: Math.min(totalPages, m.page + 1) }))}
        >
          Siguiente
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Por página:
          <select
            value={meta.pageSize}
            onChange={e => setMeta(m => ({ ...m, pageSize: Number(e.target.value), page: 1 }))}
          >
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Cargando audit trails...</p>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {!loading && data.length === 0 && <p>No hay registros.</p>}

      {data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cell}>Sel</th>
                <th style={cell}>Contrato</th>
                <th style={cell}>Usuario</th>
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
                  <tr key={`${row.contractId}-${idx}`} style={{ background: idx % 2 ? '#f9fafb' : 'white' }}>
                    <td style={cell}>
                      <input
                        type="checkbox"
                        checked={!!selected[row.contractId]}
                        onChange={() => toggleSelected(row.contractId)}
                      />
                    </td>
                    <td style={cell}>{row.contractId}</td>
                    <td style={cell}>{row.user?.email || row.user?.name || '-'}</td>
                    <td style={cell}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>
                        {label}
                      </span>
                    </td>
                    <td style={cell}>{row.lastEvent ? new Date(row.lastEvent).toLocaleString() : '-'}</td>
                    <td style={cell}>
                      <code style={{ fontSize: 12 }}>{row.auditHash ? String(row.auditHash).slice(0, 12) + '…' : '-'}</code>
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      </div>
      <div style={{ marginTop: 8, height: 6, background: '#f3f4f6', borderRadius: 999 }}>
        <div style={{ height: 6, width: `${Math.min(100, value)}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

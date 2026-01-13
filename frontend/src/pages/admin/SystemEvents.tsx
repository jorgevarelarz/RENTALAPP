import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSystemEvents, type SystemEventItem, type SystemEventsResponse } from '../../api/systemEvents';

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'COMPLIANCE_RISK_CREATED', label: 'COMPLIANCE_RISK_CREATED' },
  { value: 'ADMIN_RATE_LIMIT_HIT', label: 'ADMIN_RATE_LIMIT_HIT' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'contract', label: 'contract' },
  { value: 'admin', label: 'admin' },
];

const emptyResponse: SystemEventsResponse = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
};

export default function SystemEvents() {
  const [data, setData] = useState<SystemEventsResponse>(emptyResponse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selected, setSelected] = useState<SystemEventItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSystemEvents({
        page,
        pageSize,
        type: typeFilter || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(response || emptyResponse);
    } catch (err: any) {
      setError(err?.message || 'Error cargando eventos');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, resourceType, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, resourceType, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));
  const rangeStart = data.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, data.total || 0);

  const rows = useMemo(() => data.items || [], [data.items]);

  const renderRequestId = (item: SystemEventItem) => {
    const payload = item.payload as any;
    return payload?.requestId || '-';
  };

  const copyRequestId = async (requestId: string) => {
    if (!requestId || requestId === '-') return;
    try {
      await navigator.clipboard.writeText(requestId);
    } catch (err) {
      console.error('Clipboard error', err);
    }
  };

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>System Events</h2>
        <Link to="/admin/compliance" className="px-3 py-1.5 rounded border border-gray-300">
          Volver a compliance
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Type:
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Resource:
          <select value={resourceType} onChange={e => setResourceType(e.target.value)} style={selectStyle}>
            {RESOURCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Date from:
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Date to:
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
        </label>
        <button className="px-3 py-1.5 rounded border border-gray-300" onClick={fetchData}>
          Refrescar
        </button>
      </div>

      {loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={cellStyle}>Type</th>
                <th style={cellStyle}>Resource</th>
                <th style={cellStyle}>Resource ID</th>
                <th style={cellStyle}>Created At</th>
                <th style={cellStyle}>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {Array.from({ length: 5 }).map((__, cellIdx) => (
                    <td key={cellIdx} style={cellStyle}>
                      <div style={loadingPill} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {!loading && !error && rows.length === 0 && <div>No hay eventos aun.</div>}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={cellStyle}>Type</th>
                <th style={cellStyle}>Resource</th>
                <th style={cellStyle}>Resource ID</th>
                <th style={cellStyle}>Created At</th>
                <th style={cellStyle}>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => (
                <tr
                  key={item._id}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onClick={() => setSelected(item)}
                >
                  <td style={cellStyle}>{item.type}</td>
                  <td style={cellStyle}>{item.resourceType || '-'}</td>
                  <td style={cellStyle}>{item.resourceId || '-'}</td>
                  <td style={cellStyle}>{new Date(item.createdAt).toLocaleString()}</td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{renderRequestId(item)}</span>
                      <button
                        className="px-2 py-1 rounded border border-gray-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyRequestId(renderRequestId(item));
                        }}
                      >
                        Copiar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {rangeStart}-{rangeEnd} de {data.total || 0}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="px-3 py-1.5 rounded border border-gray-300"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>
              Pagina {page} / {totalPages}
            </span>
            <button
              className="px-3 py-1.5 rounded border border-gray-300"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div style={modalOverlay} onClick={() => setSelected(null)}>
          <div style={modalBody} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>System Event</h3>
              <button className="px-2 py-1 rounded border border-gray-300" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 6, fontSize: 14 }}>
              <div><strong>Type:</strong> {selected.type}</div>
              <div><strong>Resource:</strong> {selected.resourceType || '-'}</div>
              <div><strong>Resource ID:</strong> {selected.resourceId || '-'}</div>
              <div><strong>Created At:</strong> {new Date(selected.createdAt).toLocaleString()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Request ID:</strong>
                <span>{renderRequestId(selected)}</span>
                <button
                  className="px-2 py-1 rounded border border-gray-300"
                  onClick={() => copyRequestId(renderRequestId(selected))}
                >
                  Copiar
                </button>
              </div>
            </div>
            <pre style={codeBlock}>
              {JSON.stringify(selected.payload || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '6px 10px',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '6px 10px',
};

const cellStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: '1px solid #f1f5f9',
  fontSize: 14,
};

const loadingPill: React.CSSProperties = {
  height: 10,
  width: '80%',
  background: '#e5e7eb',
  borderRadius: 999,
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 50,
};

const modalBody: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  padding: 16,
  width: 'min(720px, 92vw)',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
  display: 'grid',
  gap: 12,
};

const codeBlock: React.CSSProperties = {
  background: '#0f172a',
  color: '#e2e8f0',
  padding: 12,
  borderRadius: 8,
  fontSize: 12,
  maxHeight: 320,
  overflow: 'auto',
};

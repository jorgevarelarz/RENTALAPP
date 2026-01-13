import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import {
  fetchComplianceDashboard,
  exportComplianceDashboardCsv,
  type ComplianceDashboardData,
  type ComplianceDashboardItem,
} from '../../api/adminCompliance';

const STATUS_LABELS: Record<string, string> = {
  compliant: 'Compliant',
  risk: 'Risk',
  non_compliant: 'Non-compliant',
};

const STATUS_TONES: Record<string, { bg: string; text: string }> = {
  compliant: { bg: '#dcfce7', text: '#166534' },
  risk: { bg: '#fef3c7', text: '#92400e' },
  non_compliant: { bg: '#fee2e2', text: '#991b1b' },
};

const SEVERITY_TONES: Record<string, { bg: string; text: string }> = {
  info: { bg: '#f3f4f6', text: '#374151' },
  warning: { bg: '#fef3c7', text: '#92400e' },
  critical: { bg: '#fee2e2', text: '#991b1b' },
};

const emptyDashboard: ComplianceDashboardData = {
  totals: { evaluated: 0, risk: 0 },
  byArea: [],
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
};

const isDemoMode =
  String(process.env.REACT_APP_RENTAL_PUBLIC_DEMO_MODE || (process.env as any).VITE_RENTAL_PUBLIC_DEMO_MODE || '')
    .toLowerCase() === 'true';

export default function ComplianceDashboard() {
  const [data, setData] = useState<ComplianceDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [areaKey, setAreaKey] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await fetchComplianceDashboard({
        page,
        pageSize,
        status: statusFilter || undefined,
        areaKey: areaKey || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(dashboard || emptyDashboard);
    } catch (err: any) {
      setError(err?.message || 'Error cargando compliance');
    } finally {
      setLoading(false);
    }
  }, [areaKey, dateFrom, dateTo, page, pageSize, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, areaKey, dateFrom, dateTo]);

  const filteredItems = useMemo(() => data.items, [data.items]);

  const totals = data.totals || { evaluated: data.items.length, risk: 0 };
  const nonCompliantCount = data.items.filter(i => i.status === 'non_compliant').length;
  const compliantCount = Math.max(0, (totals.evaluated || 0) - (totals.risk || 0) - nonCompliantCount);
  const totalRows = data.total ?? totals.evaluated ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalRows);
  const lastUpdatedLabel = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '-';

  const handleExport = async () => {
    try {
      const blob = await exportComplianceDashboardCsv({
        status: statusFilter || undefined,
        areaKey: areaKey || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compliance-dashboard.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Error exportando CSV');
    }
  };

  const renderStatusBadge = (status?: string) => {
    const tone = (status && STATUS_TONES[status]) || { bg: '#f3f4f6', text: '#374151' };
    const label = STATUS_LABELS[status || ''] || status || '-';
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
        style={{ background: tone.bg, color: tone.text }}
      >
        {label}
      </span>
    );
  };

  const renderSeverityBadge = (severity?: string) => {
    const tone = (severity && SEVERITY_TONES[severity]) || { bg: '#f3f4f6', text: '#374151' };
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
        style={{ background: tone.bg, color: tone.text }}
      >
        {severity || '-'}
      </span>
    );
  };

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Compliance (Rental Public)</h2>
          {isDemoMode && <Badge tone="highlight">Demo mode</Badge>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/admin/compliance/tensioned-areas" className="px-3 py-1.5 rounded border border-gray-300">
            Zonas tensionadas
          </Link>
          <Link to="/admin/compliance/audit-trails" className="px-3 py-1.5 rounded border border-gray-300">
            Audit Trails (firma)
          </Link>
          <Link to="/admin/compliance/policies" className="px-3 py-1.5 rounded border border-gray-300">
            Politicas
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <div style={cardLabel}>Contratos evaluados</div>
          <div style={cardValue}>{totals.evaluated || 0}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>En riesgo</div>
          <div style={cardValue}>{totals.risk || 0}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>Compliant</div>
          <div style={cardValue}>{compliantCount}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>Non-compliant</div>
          <div style={cardValue}>{nonCompliantCount}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabel}>Last updated</div>
          <div style={{ ...cardValue, fontSize: 16 }}>{lastUpdatedLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Status:
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">Todos</option>
            <option value="risk">Risk</option>
            <option value="compliant">Compliant</option>
            <option value="non_compliant">Non-compliant</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          AreaKey:
          <input value={areaKey} onChange={e => setAreaKey(e.target.value)} placeholder="galicia|oleiros|" style={inputStyle} />
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
        <button className="px-3 py-1.5 rounded border border-gray-300" onClick={handleExport}>
          Export CSV
        </button>
      </div>

      {loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={cellStyle}>Property / Contract</th>
                <th style={cellStyle}>AreaKey / Region / Ciudad</th>
                <th style={cellStyle}>Renta</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Severity</th>
                <th style={cellStyle}>Checked At</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {Array.from({ length: 6 }).map((__, cellIdx) => (
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
      {!loading && !error && filteredItems.length === 0 && <div>No hay datos aun.</div>}

      {!loading && filteredItems.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={cellStyle}>Property / Contract</th>
                <th style={cellStyle}>AreaKey / Region / Ciudad</th>
                <th style={cellStyle}>Renta</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Severity</th>
                <th style={cellStyle}>Checked At</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item: ComplianceDashboardItem) => (
                <tr key={`${item.contractId}-${item.propertyId}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={cellStyle}>
                    <div>{item.propertyAddress || item.propertyId}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{item.contractId}</div>
                  </td>
                  <td style={cellStyle}>
                    <div>{item.areaKey || '-'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {(item.propertyRegion || '-') + ' / ' + (item.propertyCity || '-')}
                    </div>
                  </td>
                  <td style={cellStyle}>
                    {item.previousRent} EUR -> {item.newRent} EUR
                  </td>
                  <td style={cellStyle}>{renderStatusBadge(item.status)}</td>
                  <td style={cellStyle}>{renderSeverityBadge(item.severity)}</td>
                  <td style={cellStyle}>
                    {item.checkedAt ? new Date(item.checkedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalRows > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {rangeStart}-{rangeEnd} de {totalRows}
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
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '12px 14px',
  background: 'white',
};

const cardLabel: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
};

const cardValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  marginTop: 6,
};

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

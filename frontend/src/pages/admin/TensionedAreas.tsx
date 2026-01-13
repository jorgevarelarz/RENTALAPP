import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchTensionedAreas,
  type TensionedArea,
} from '../../api/adminCompliance';

export default function TensionedAreas() {
  const [areas, setAreas] = useState<TensionedArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [active, setActive] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (region) params.region = region;
      if (city) params.city = city;
      if (active) params.active = active;
      const data = await fetchTensionedAreas(params);
      setAreas(data || []);
    } catch (err: any) {
      setError(err?.message || 'Error cargando zonas tensionadas');
    } finally {
      setLoading(false);
    }
  }, [region, city, active]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return areas.filter(area => {
      if (region && area.region !== region) return false;
      if (city && area.city !== city) return false;
      if (active && String(area.active) !== active) return false;
      return true;
    });
  }, [areas, region, city, active]);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Zonas tensionadas</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/admin/compliance" className="px-3 py-1.5 rounded border border-gray-300">
            Volver a compliance
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Region:
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="galicia" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          City:
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="oleiros" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Active:
          <select value={active} onChange={e => setActive(e.target.value)} style={selectStyle}>
            <option value="">Todos</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </label>
        <button className="px-3 py-1.5 rounded border border-gray-300" onClick={fetchData}>
          Refrescar
        </button>
      </div>

      {loading && <div>Cargando zonas...</div>}
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && <div>No hay zonas aun.</div>}

      {!loading && filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={cellStyle}>Region</th>
                <th style={cellStyle}>City</th>
                <th style={cellStyle}>Zone Code</th>
                <th style={cellStyle}>AreaKey</th>
                <th style={cellStyle}>Effective From</th>
                <th style={cellStyle}>Effective To</th>
                <th style={cellStyle}>Active</th>
                <th style={cellStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(area => (
                <tr key={area._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={cellStyle}>{area.region}</td>
                  <td style={cellStyle}>{area.city || '-'}</td>
                  <td style={cellStyle}>{area.zoneCode || '-'}</td>
                  <td style={cellStyle}>{area.areaKey}</td>
                  <td style={cellStyle}>{area.effectiveFrom ? new Date(area.effectiveFrom).toLocaleDateString() : '-'}</td>
                  <td style={cellStyle}>{area.effectiveTo ? new Date(area.effectiveTo).toLocaleDateString() : '-'}</td>
                  <td style={cellStyle}>{area.active ? 'true' : 'false'}</td>
                  <td style={cellStyle}>{area.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '6px 10px',
};

const selectStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '6px 10px',
};

const cellStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: '1px solid #f1f5f9',
  fontSize: 14,
};

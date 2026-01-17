import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchTensionedAreas,
  type TensionedArea,
  upsertTensionedArea,
} from '../../api/adminCompliance';

export default function TensionedAreas() {
  const [areas, setAreas] = useState<TensionedArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [active, setActive] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formZoneCode, setFormZoneCode] = useState('');
  const [formAreaKey, setFormAreaKey] = useState('');
  const [formSource, setFormSource] = useState('manual');
  const [formMaxRent, setFormMaxRent] = useState('');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formGeometry, setFormGeometry] = useState('');
  const [formStatus, setFormStatus] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    setFormStatus(null);
    setError(null);
    try {
      const geometry = formGeometry.trim()
        ? (JSON.parse(formGeometry) as {
            type: 'Polygon' | 'MultiPolygon';
            coordinates: number[][][] | number[][][][];
          })
        : undefined;

      const payload = {
        region: formRegion.trim().toLowerCase(),
        city: formCity.trim().toLowerCase() || undefined,
        zoneCode: formZoneCode.trim().toLowerCase() || undefined,
        areaKey: formAreaKey.trim().toLowerCase() || undefined,
        source: formSource.trim() || 'manual',
        maxRent: formMaxRent.trim() ? Number(formMaxRent) : undefined,
        effectiveFrom: formEffectiveFrom,
        effectiveTo: formEffectiveTo || undefined,
        active: formActive,
        geometry,
      };

      if (!payload.region || !payload.source || !payload.effectiveFrom) {
        throw new Error('Region, source y effectiveFrom son obligatorios');
      }

      await upsertTensionedArea(payload);
      setFormStatus('Zona guardada correctamente');
      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la zona');
    }
  };

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

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Crear o actualizar zona</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={labelStyle}>
            Region *
            <input
              value={formRegion}
              onChange={e => setFormRegion(e.target.value)}
              placeholder="galicia"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            City
            <input
              value={formCity}
              onChange={e => setFormCity(e.target.value)}
              placeholder="oleiros"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Zone Code
            <input
              value={formZoneCode}
              onChange={e => setFormZoneCode(e.target.value)}
              placeholder="centro"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            AreaKey
            <input
              value={formAreaKey}
              onChange={e => setFormAreaKey(e.target.value)}
              placeholder="galicia|oleiros|"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Source *
            <input
              value={formSource}
              onChange={e => setFormSource(e.target.value)}
              placeholder="manual"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Max rent
            <input
              type="number"
              min="0"
              value={formMaxRent}
              onChange={e => setFormMaxRent(e.target.value)}
              placeholder="1200"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Effective From *
            <input
              type="date"
              value={formEffectiveFrom}
              onChange={e => setFormEffectiveFrom(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Effective To
            <input
              type="date"
              value={formEffectiveTo}
              onChange={e => setFormEffectiveTo(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            Activa
            <input
              type="checkbox"
              checked={formActive}
              onChange={e => setFormActive(e.target.checked)}
            />
          </label>
        </div>
        <label style={labelStyle}>
          Geometry (GeoJSON Polygon/MultiPolygon)
          <textarea
            value={formGeometry}
            onChange={e => setFormGeometry(e.target.value)}
            placeholder='{"type":"Polygon","coordinates":[[[...]]]}' 
            style={textAreaStyle}
            rows={4}
          />
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="px-3 py-1.5 rounded border border-gray-300" onClick={handleSubmit}>
            Guardar zona
          </button>
          {formStatus && <span style={{ color: '#15803d' }}>{formStatus}</span>}
        </div>
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
                <th style={cellStyle}>Max rent</th>
                <th style={cellStyle}>Geometry</th>
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
                  <td style={cellStyle}>{typeof area.maxRent === 'number' ? area.maxRent : '-'}</td>
                  <td style={cellStyle}>{area.geometry?.type || '-'}</td>
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

const textAreaStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '6px 10px',
  minWidth: 280,
  fontFamily: 'monospace',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const cellStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: '1px solid #f1f5f9',
  fontSize: 14,
};

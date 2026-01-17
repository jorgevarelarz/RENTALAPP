import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

type User = {
  _id: string;
  email: string;
  role: string;
};

type AuthState = {
  token: string;
  user: User;
};

type DashboardItem = {
  caseId: string;
  areaKey?: string;
  previousRent: number;
  newRent: number;
  status: string;
  severity: string;
  checkedAt: string;
};

type DashboardData = {
  totals: { evaluated: number; risk: number };
  lastUpdated?: string | null;
  byArea: { areaKey: string; total: number; risk: number }[];
  items: DashboardItem[];
  page: number;
  pageSize: number;
  total: number;
};

const STORAGE_KEY = 'institution_auth';
const emptyDashboard: DashboardData = {
  totals: { evaluated: 0, risk: 0 },
  byArea: [],
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
};

function loadStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

function storeAuth(auth: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function Login({ onAuth }: { onAuth: (auth: AuthState) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.message || 'Login failed');
      }

      const auth = { token: payload.token, user: payload.user } as AuthState;
      if (auth.user?.role !== 'institution_viewer') {
        throw new Error('No autorizado para este portal');
      }

      storeAuth(auth);
      onAuth(auth);
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card login-panel">
        <h2>Acceso institucional</h2>
        <p className="notice">
          Este portal es exclusivo para administraciones publicas con alcance territorial habilitado.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email institucional"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {error && <div className="notice">{error}</div>}
        </form>
      </div>
    </div>
  );
}

function ComplianceDashboard({ auth }: { auth: AuthState }) {
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [areaKey, setAreaKey] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (areaKey) params.set('areaKey', areaKey);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/institution/compliance/dashboard?${params.toString()}` , {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudo cargar el dashboard');
      }
      setData(payload.data || emptyDashboard);
    } catch (err: any) {
      setError(err?.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [areaKey, auth.token, dateFrom, dateTo, page, pageSize, status]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    setPage(1);
  }, [status, areaKey, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));
  const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '-';

  const byArea = useMemo(() => data.byArea || [], [data.byArea]);

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (areaKey) params.set('areaKey', areaKey);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/institution/compliance/dashboard/export.csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) {
        throw new Error('No se pudo exportar el CSV');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'institution-compliance.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Error exportando CSV');
    }
  };

  return (
    <div className="page">
      <div className="hero">
        <div>
          <h1>Rental Public - Portal institucional</h1>
          <p>Supervision territorial con datos anonimizados y filtros avanzados.</p>
        </div>
        <div className="actions">
          <button className="button" onClick={() => fetchDashboard()}>
            Refrescar
          </button>
          <button className="button primary" onClick={exportCsv}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Contratos evaluados</div>
          <div className="kpi-value">{data.totals.evaluated || 0}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Riesgo</div>
          <div className="kpi-value">{data.totals.risk || 0}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Ultima actualizacion</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>{lastUpdated}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Areas monitorizadas</div>
          <div className="kpi-value">{byArea.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="controls">
          <label className="control">
            Status
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="risk">Riesgo</option>
              <option value="compliant">Compliant</option>
              <option value="non_compliant">Non-compliant</option>
            </select>
          </label>
          <label className="control">
            Area key
            <input
              value={areaKey}
              onChange={event => setAreaKey(event.target.value)}
              placeholder="galicia|oleiros|"
            />
          </label>
          <label className="control">
            Desde
            <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          </label>
          <label className="control">
            Hasta
            <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          </label>
        </div>
      </div>

      {error && <div className="notice" style={{ marginBottom: 16 }}>{error}</div>}
      {loading && <div className="notice">Cargando datos...</div>}

      {!loading && data.items.length === 0 && (
        <div className="notice">No hay registros con los filtros actuales.</div>
      )}

      {!loading && data.items.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Area</th>
                <th>Renta</th>
                <th>Status</th>
                <th>Severidad</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(item => (
                <tr key={item.caseId + item.checkedAt}>
                  <td>{item.caseId}</td>
                  <td>{item.areaKey || '-'}</td>
                  <td>{item.previousRent} {'->'} {item.newRent}</td>
                  <td>
                    <span className={`badge ${item.status === 'risk' ? 'warn' : 'ok'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.severity}</td>
                  <td>{item.checkedAt ? new Date(item.checkedAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.total > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="controls" style={{ justifyContent: 'space-between' }}>
            <div>Pagina {data.page} de {totalPages}</div>
            <div className="actions">
              <button className="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                Anterior
              </button>
              <button className="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccessDenied({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="page">
      <div className="card">
        <h2>Acceso restringido</h2>
        <p className="notice">
          Tu cuenta no tiene permisos institucionales. Contacta al administrador para asignar el rol.
        </p>
        <button className="button" onClick={onLogout}>Salir</button>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadStoredAuth());

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
  };

  if (!auth) {
    return <Login onAuth={setAuth} />;
  }

  if (auth.user?.role !== 'institution_viewer') {
    return <AccessDenied onLogout={handleLogout} />;
  }

  return (
    <Routes>
      <Route path="/compliance" element={<ComplianceDashboard auth={auth} />} />
      <Route path="/" element={<Navigate to="/compliance" replace />} />
    </Routes>
  );
}

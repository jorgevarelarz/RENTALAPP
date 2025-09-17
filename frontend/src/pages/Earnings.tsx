import React, { useEffect, useMemo, useState } from 'react';
import { earningsSummary, earningsList, earningsExportCsv } from '../services/admin';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';

function fmt(n?: number) { return (n ?? 0).toFixed(2); }

const Bar: React.FC<{ label: string; value: number; max: number }>= ({ label, value, max }) => {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 12, opacity: .8 }}>{label}</div>
      <div style={{ background: 'var(--border)', height: 10, borderRadius: 999 }}>
        <div style={{ width: `${width}%`, background: 'var(--primary)', height: '100%', borderRadius: 999 }} />
      </div>
      <div style={{ textAlign: 'right', fontWeight: 700 }}>€{fmt(value)}</div>
    </div>
  );
};

const Earnings: React.FC = () => {
  const { token, user } = useAuth();
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'day'|'month'>('day');
  const [summary, setSummary] = useState<any | null>(null);
  const [list, setList] = useState<any | null>(null);

  const maxGross = useMemo(() => Math.max(0, ...(summary?.items?.map((x:any)=>x.gross)||[0])), [summary]);

  useEffect(() => {
    const run = async () => {
      if (!token || !user) return;
      const s = await earningsSummary(token, user._id, { from, to, groupBy });
      setSummary(s);
      const l = await earningsList(token, user._id, { from, to, page: 1, limit: 20 });
      setList(l);
    };
    run();
  }, [token, user, from, to, groupBy]);

  if (!token || !user) return <div>Inicia sesión</div>;

  return (
    <div>
      <h2>Ingresos</h2>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Desde</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Hasta</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Agrupar</span>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}>
              <option value="day">Día</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <button onClick={async () => {
            if (!token || !user) return;
            const blob = await earningsExportCsv(token, user._id, { from, to });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `earnings_${from||''}_${to||''}.csv`; a.click();
            URL.revokeObjectURL(url);
          }}>Exportar CSV</button>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <h3>Resumen</h3>
          {summary ? (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div><b>Bruto:</b> €{fmt(summary.totals?.gross)}</div>
              <div><b>Comisión:</b> €{fmt(summary.totals?.fee)}</div>
              <div><b>Neto:</b> €{fmt(summary.totals?.net)}</div>
            </div>
          ) : 'Cargando...'}
        </Card>
        <Card style={{ padding: 16 }}>
          <h3>Serie</h3>
          {summary ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {summary.items.map((it:any) => (
                <Bar key={it.period} label={it.period} value={it.gross} max={maxGross} />
              ))}
            </div>
          ) : 'Cargando...'}
        </Card>
      </div>
      <Card style={{ padding: 16, marginTop: 16 }}>
        <h3>Operaciones</h3>
        {!list ? 'Cargando...' : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 8 }}>Fecha</th>
                  <th style={{ padding: 8 }}>Ticket</th>
                  <th style={{ padding: 8 }}>Bruto</th>
                  <th style={{ padding: 8 }}>Comisión</th>
                  <th style={{ padding: 8 }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((r:any) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 8 }}>{r.createdAt ? String(r.createdAt).slice(0,10) : ''}</td>
                    <td style={{ padding: 8 }}>{r.ticketId || '-'}</td>
                    <td style={{ padding: 8 }}>€{fmt(r.gross)}</td>
                    <td style={{ padding: 8 }}>€{fmt(r.fee)}</td>
                    <td style={{ padding: 8 }}>€{fmt(r.netToPro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Earnings;

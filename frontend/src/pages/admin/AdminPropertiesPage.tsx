import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';

export default function AdminPropertiesPage() {
  // server-side paginated items via react-query
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [onlyPro, setOnlyPro] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['admin/properties', { q, onlyPro, status, page, limit: pageSize }],
    queryFn: async () => {
      setError(null);
      const params: any = { page, limit: pageSize };
      if (q) params.q = q;
      if (onlyPro) params.onlyTenantPro = (onlyPro === 'yes');
      if (status) params.status = status;
      const { data } = await api.get('/api/properties', { params });
      return data as { items: any[]; total: number; page: number; limit: number };
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || pageSize)));
  const pageItems = data?.items || [];

  return (
    <div style={{ padding: 24 }}>
      <h2>Propiedades</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 12px' }}>
        <input placeholder="Buscar por título o ciudad…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '8px 12px', width: 320 }} />
        <select value={onlyPro} onChange={e => { setOnlyPro(e.target.value); setPage(1); }} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '8px 12px' }}>
          <option value="">Tenant PRO: todos</option>
          <option value="yes">Solo PRO</option>
          <option value="no">Normales</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '8px 12px' }}>
          <option value="">Estado: todos</option>
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
          <option value="archived">Archivada</option>
        </select>
      </div>
      <div style={{ marginBottom: 8 }}>
        <button
          className="px-3 py-1.5 rounded border border-gray-300"
          onClick={() => {
            const rows = pageItems.map((p:any)=>({ title: p.title, city: p.city, price: p.price, onlyTenantPro: !!p.onlyTenantPro, status: p.status }));
            const header = 'title,city,price,onlyTenantPro,status\n';
            const body = rows.map(r=>[
              JSON.stringify(r.title||''),
              JSON.stringify(r.city||''),
              r.price,
              r.onlyTenantPro?'yes':'no',
              r.status||''
            ].join(',')).join('\n');
            const blob = new Blob([header+body], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `properties_page_${data?.page||1}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >Exportar CSV (página)</button>
      </div>
      {isLoading && <div>Cargando…</div>}
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {!isLoading && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: 8 }}>Título</th>
              <th style={{ padding: 8 }}>Ciudad</th>
              <th style={{ padding: 8 }}>Precio</th>
              <th style={{ padding: 8 }}>Tenant PRO</th>
              <th style={{ padding: 8 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(p => (
              <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>{p.title}</td>
                <td style={{ padding: 8 }}>{p.city}</td>
                <td style={{ padding: 8 }}>{p.price} €</td>
                <td style={{ padding: 8 }}>{p.onlyTenantPro ? 'Sí' : 'No'}</td>
                <td style={{ padding: 8 }}>{p.status}</td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 12 }}>No hay propiedades para esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '6px 10px' }}>Anterior</button>
        <span className="text-sm text-gray-700">Página {data?.page || page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '6px 10px' }}>Siguiente</button>
      </div>
    </div>
  );
}

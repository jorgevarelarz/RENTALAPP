import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useQuery({
    queryKey: ['admin/users', { q, role, page, limit: pageSize }],
    queryFn: async () => {
      setError(null);
      const { data } = await api.get('/api/users', { params: { q, role, page, limit: pageSize } });
      return data as { items: any[]; total: number; page: number; limit: number };
    },
  });
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || pageSize)));
  const pageItems = data?.items || [];

  return (
    <div style={{ padding: 24 }}>
      <h2>Usuarios</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 12px' }}>
        <input placeholder="Buscar por email o rol…" value={q} onChange={e => setQ(e.target.value)} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '8px 12px', width: 320 }} />
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '8px 12px' }}>
          <option value="">Todos</option>
          <option value="tenant">Tenant</option>
          <option value="landlord">Landlord</option>
          <option value="pro">PRO</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div style={{ marginBottom: 8 }}>
        <button
          className="px-3 py-1.5 rounded border border-gray-300"
          onClick={() => {
            const rows = pageItems.map((u:any)=>({ email: u.email, role: u.role, createdAt: u.createdAt }));
            const header = 'email,role,createdAt\n';
            const body = rows.map(r=>[r.email, r.role, r.createdAt?String(r.createdAt):''].join(',')).join('\n');
            const blob = new Blob([header+body], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `users_page_${data?.page||1}.csv`;
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
              <th style={{ padding: 8 }}>Email</th>
              <th style={{ padding: 8 }}>Rol</th>
              <th style={{ padding: 8 }}>Creado</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>{u.email}</td>
                <td style={{ padding: 8 }}>{u.role}</td>
                <td style={{ padding: 8 }}>{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 12 }}>No hay usuarios para esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '6px 10px' }}>Anterior</button>
        <span style={{ fontSize: 12, color: '#6B7280' }}>Página {data?.page || page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '6px 10px' }}>Siguiente</button>
      </div>
    </div>
  );
}

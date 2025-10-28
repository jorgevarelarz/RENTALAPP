import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listMyTickets } from "../../api/tickets";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";

export default function TicketsList() {
  const { user } = useAuth();
  const role = user?.role === "pro" ? "pro" : user?.role === "landlord" ? "landlord" : "tenant";
  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState(() => Number(sp.get('page') || 1));
  const [q, setQ] = useState(() => sp.get('q') || "");
  const [status, setStatus] = useState(() => sp.get('status') || "");
  const [showFilters, setShowFilters] = useState(true);
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", role, { page, status }],
    queryFn: async () => listMyTickets(role as any, { page, status }),
  });

  // Sincroniza query params ↔ estado
  React.useEffect(() => {
    const next = new URLSearchParams();
    next.set('page', String(page));
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [page, q, status, sp, setSp]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const items = data?.items || [];
    if (!term) return items;
    return items.filter(t =>
      String(t.title || "").toLowerCase().includes(term) ||
      String(t.status || "").toLowerCase().includes(term) ||
      String(t.service || "").toLowerCase().includes(term)
    );
  }, [data, q]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Incidencias ({role})</h2>
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '8px 12px' }}
          aria-expanded={showFilters}
          aria-controls="tickets-filters"
        >
          {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
        </button>
      </div>
      {showFilters && (
        <div id="tickets-filters" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <input
            placeholder="Buscar por título, estado o servicio…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>Estado</label>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="open">Abierto</option>
              <option value="quoted">Presupuestado</option>
              <option value="awaiting_schedule">Pendiente de cita</option>
              <option value="scheduled">Programado</option>
              <option value="in_progress">En curso</option>
              <option value="awaiting_approval">Pendiente de aprobación</option>
              <option value="done">Finalizado</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
        </div>
      )}
      {isLoading && <div>Cargando…</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: 8 }}>ID</th>
            <th style={{ padding: 8 }}>Título</th>
            <th style={{ padding: 8 }}>Servicio</th>
            <th style={{ padding: 8 }}>Estado</th>
            <th style={{ padding: 8 }}>Actualizado</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((ticket) => (
            <tr key={ticket._id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{ticket._id.slice(-6)}</td>
              <td style={{ padding: 8 }}>{ticket.title}</td>
              <td style={{ padding: 8 }}>{ticket.service}</td>
              <td style={{ padding: 8 }}>{ticket.status}</td>
              <td style={{ padding: 8 }}>{new Date(ticket.updatedAt).toLocaleString()}</td>
              <td style={{ padding: 8 }}>
                <Link to={`/tickets/${ticket._id}`}>Ver</Link>
              </td>
            </tr>
          ))}
          {!((data?.items || []).length) && (
            <tr>
              <td colSpan={6} style={{ padding: 12 }}>
                No hay incidencias.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <button disabled={(data?.page || 1) <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '6px 10px' }}>Anterior</button>
        <span style={{ fontSize: 12, color: '#6B7280' }}>Página {data?.page || 1}</span>
        <button disabled={((data?.page || 1) * 10) >= (data?.total || 0)} onClick={() => setPage(p => p + 1)} style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: '6px 10px' }}>Siguiente</button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMyTickets } from "../../services/tickets";
import { useAuth } from "../../context/AuthContext";

export default function TicketsList() {
  const { user } = useAuth();
  const role = user?.role === "pro" ? "pro" : user?.role === "landlord" ? "landlord" : "tenant";
  const [data, setData] = useState<{ items: any[]; page: number; total: number }>({ items: [], page: 1, total: 0 });

  const load = async (page = 1) => {
    const res = await listMyTickets(role as "tenant" | "landlord" | "pro", { page });
    setData(res);
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Incidencias ({role})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Servicio</th>
            <th>Estado</th>
            <th>Actualizado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((ticket) => (
            <tr key={ticket._id} style={{ borderTop: "1px solid #eee" }}>
              <td>{ticket._id.slice(-6)}</td>
              <td>{ticket.title}</td>
              <td>{ticket.service}</td>
              <td>{ticket.status}</td>
              <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
              <td>
                <Link to={`/tickets/${ticket._id}`}>Ver</Link>
              </td>
            </tr>
          ))}
          {!data.items.length && (
            <tr>
              <td colSpan={6} style={{ padding: 12 }}>
                No hay incidencias.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

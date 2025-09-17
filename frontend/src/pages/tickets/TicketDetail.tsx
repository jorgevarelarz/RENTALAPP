import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getTicket,
  assignPro,
  unassignPro,
  sendQuote,
  approveQuote,
  requestExtra,
  decideExtra,
  completeWork,
  closeTicket,
  openDispute,
} from "../../services/tickets";
import { proposeAppointment as proposeAppt } from "../../services/appointments";
import { searchPros } from "../../services/pros";
import { useAuth } from "../../context/AuthContext";

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [pros, setPros] = useState<any[]>([]);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [extraAmount, setExtraAmount] = useState<number>(0);
  const [extraReason, setExtraReason] = useState("");
  const [when, setWhen] = useState<string>("");

  const role = user?.role;

  const reload = async () => {
    if (!id) return;
    const data = await getTicket(id);
    setTicket(data);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const can = (statuses: string[]) => statuses.includes(ticket?.status);

  const onAssignPro = async (proId: string) => {
    await assignPro(ticket._id, proId);
    await reload();
  };

  const onUnassign = async () => {
    await unassignPro(ticket._id);
    await reload();
  };

  const onSendQuote = async () => {
    await sendQuote(ticket._id, amount, note);
    await reload();
  };

  const onApproveQuote = async () => {
    await approveQuote(ticket._id);
    await reload();
  };

  const onRequestExtra = async () => {
    await requestExtra(ticket._id, extraAmount, extraReason);
    await reload();
  };

  const onDecideExtra = async (decision: "approved" | "rejected") => {
    await decideExtra(ticket._id, decision);
    await reload();
  };

  const onProposeAppt = async () => {
    await proposeAppt(ticket._id, when);
    setWhen("");
    await reload();
  };

  const onComplete = async () => {
    await completeWork(ticket._id);
    await reload();
  };

  const onClose = async () => {
    await closeTicket(ticket._id);
    await reload();
  };

  const onDispute = async () => {
    const reason = window.prompt("Motivo de disputa");
    if (reason) {
      await openDispute(ticket._id, reason);
      await reload();
    }
  };

  const loadPros = async () => {
    const list = await searchPros(ticket?.city, ticket?.service);
    setPros(list.items || []);
  };

  if (!ticket) return <div style={{ padding: 24 }}>Cargando…</div>;

  return (
    <div style={{ padding: 24, display: "grid", gap: 12, maxWidth: 920, margin: "0 auto" }}>
      <h2>
        Incidencia #{ticket._id.slice(-6)} — {ticket.title}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div>
            <b>Servicio:</b> {ticket.service}
          </div>
          <div>
            <b>Estado:</b> {ticket.status}
          </div>
          <div>
            <b>Propiedad:</b> {ticket.propertyAddress || "—"}
          </div>
          <div>
            <b>Asignado a:</b> {ticket.pro?.displayName || "Sin asignar"}
          </div>
          <div>
            <b>Presupuesto:</b> {ticket.quote?.amount ? `${ticket.quote.amount} €` : "—"}
          </div>
          {ticket.extra && (
            <div>
              <b>Extra:</b> {ticket.extra.amount} € · {ticket.extra.status}
            </div>
          )}
        </div>
        <div>
          <h3>Acciones</h3>

          {role === "landlord" && can(["open", "quoted", "awaiting_schedule"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <button onClick={loadPros}>Buscar profesionales</button>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {pros.map((pro) => (
                  <div
                    key={pro._id}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div>
                      {pro.displayName} · {pro.city} · {(pro.services || []).join(", ")}
                    </div>
                    <button onClick={() => onAssignPro(pro._id)}>Asignar</button>
                  </div>
                ))}
                {ticket.pro && <button onClick={onUnassign}>Quitar asignación</button>}
              </div>
            </div>
          )}

          {role === "pro" && can(["open"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div>
                <b>Enviar presupuesto</b>
              </div>
              <input
                type="number"
                placeholder="Importe €"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <input placeholder="Nota" value={note} onChange={(e) => setNote(e.target.value)} />
              <button onClick={onSendQuote} disabled={!amount}>
                Enviar
              </button>
            </div>
          )}

          {role === "landlord" && can(["quoted"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div>
                Presupuesto recibido: <b>{ticket.quote?.amount} €</b>
              </div>
              <button onClick={onApproveQuote}>Aprobar y pagar (mock)</button>
            </div>
          )}

          {role === "pro" && can(["in_progress", "awaiting_approval"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div>
                <b>Solicitar extra</b>
              </div>
              <input
                type="number"
                placeholder="Importe extra €"
                value={extraAmount || ""}
                onChange={(e) => setExtraAmount(Number(e.target.value))}
              />
              <input placeholder="Motivo" value={extraReason} onChange={(e) => setExtraReason(e.target.value)} />
              <button onClick={onRequestExtra} disabled={!extraAmount || !extraReason}>
                Enviar
              </button>
            </div>
          )}

          {role === "landlord" && ticket.extra?.status === "pending" && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div>
                Extra solicitado: <b>{ticket.extra.amount} €</b> — {ticket.extra.reason}
              </div>
              <button onClick={() => onDecideExtra("approved")}>Aprobar</button>
              <button onClick={() => onDecideExtra("rejected")}>Rechazar</button>
            </div>
          )}

          {(role === "pro" || role === "landlord" || role === "tenant") &&
            can(["quoted", "awaiting_schedule", "in_progress"]) && (
              <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
                <div>
                  <b>Proponer cita</b>
                </div>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                <button onClick={onProposeAppt} disabled={!when}>
                  Proponer
                </button>
              </div>
            )}

          {role === "pro" && can(["in_progress"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <button onClick={onComplete}>Trabajo completado</button>
            </div>
          )}

          {(role === "landlord" || role === "tenant") && can(["done"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <button onClick={onClose}>Cerrar incidencia</button>
              <button onClick={onDispute}>Abrir disputa</button>
            </div>
          )}
        </div>
      </div>
      <div>
        <h3>Descripción</h3>
        <p>{ticket.description || "—"}</p>
      </div>
      {ticket.history?.length ? (
        <div>
          <h3>Historial</h3>
          <ul>
            {ticket.history.map((item: any, index: number) => (
              <li key={index}>
                {item.action} — {new Date(item.ts || item.date || Date.now()).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

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
} from "../../api/tickets";
import { proposeAppointment as proposeAppt, acceptAppointment, rejectAppointment } from "../../api/appointments";
import ChatPanel from "../../components/chat/ChatPanel";
import { searchPros } from "../../api/pros";
import { useAuth } from "../../context/AuthContext";
import { useNotify } from "../../utils/notify";
import CopyLinkButton from "../../components/ui/CopyLinkButton";
import { sendEmail, sendSms } from "../../api/notify";

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
  const [rejectWhy, setRejectWhy] = useState<string>("");

  const role = user?.role;
  const { push } = useNotify();

  const showError = (err: any, fallback: string) => {
    push("error", err?.response?.data?.error || fallback);
  };

  const triggerEmail = async (subject: string, body: string, to?: string) => {
    try {
      await sendEmail(to || "notificaciones@rental-app.test", subject, body);
    } catch (error) {
      console.warn("Fallo al disparar email mock", error);
    }
  };

  const triggerSms = async (body: string, to?: string) => {
    try {
      await sendSms(to || "+34900123456", body);
    } catch (error) {
      console.warn("Fallo al disparar SMS mock", error);
    }
  };

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
    try {
      await assignPro(ticket._id, proId);
      push("success", "Profesional asignado al ticket");
      await triggerEmail(
        "Nuevo profesional asignado",
        `Se ha asignado un profesional a la incidencia ${ticket._id}.`
      );
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo asignar el profesional");
    }
  };

  const onUnassign = async () => {
    try {
      await unassignPro(ticket._id);
      push("info", "Asignación eliminada");
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo quitar la asignación");
    }
  };

  const onSendQuote = async () => {
    try {
      await sendQuote(ticket._id, amount, note);
      push("success", "Presupuesto enviado al propietario");
      await triggerEmail(
        "Nuevo presupuesto disponible",
        `El profesional ha enviado un presupuesto por ${amount} €.`
      );
      await reload();
    } catch (err: any) {
      showError(err, "Error al enviar presupuesto");
    }
  };

  const onApproveQuote = async () => {
    try {
      await approveQuote(ticket._id);
      push("success", "Presupuesto aprobado");
      await triggerEmail(
        "Presupuesto aprobado",
        `El propietario ha aprobado el presupuesto del ticket ${ticket._id}.`
      );
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo aprobar el presupuesto");
    }
  };

  const onRequestExtra = async () => {
    try {
      await requestExtra(ticket._id, extraAmount, extraReason);
      push("info", "Solicitud de extra enviada");
      await triggerEmail(
        "Solicitud de extra",
        `Hay una nueva solicitud de extra por ${extraAmount} €. Motivo: ${extraReason}.`
      );
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo solicitar el extra");
    }
  };

  const onDecideExtra = async (decision: "approved" | "rejected") => {
    try {
      await decideExtra(ticket._id, decision);
      push(
        decision === "approved" ? "success" : "info",
        decision === "approved" ? "Extra aprobado" : "Extra rechazado"
      );
      await triggerEmail(
        "Resolución de extra",
        `El extra solicitado ha sido ${decision === "approved" ? "aprobado" : "rechazado"}.`
      );
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo actualizar el extra");
    }
  };

  const onProposeAppt = async () => {
    try {
      await proposeAppt(ticket._id, when);
      setWhen("");
      push("success", "Propuesta de cita enviada");
      await triggerSms(
        `Hay una nueva propuesta de cita para la incidencia ${ticket._id}.`
      );
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo proponer la cita");
    }
  };

  const onAcceptAppt = async () => {
    try {
      await acceptAppointment(ticket._id);
      push("success", "Cita aceptada");
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo aceptar la cita");
    }
  };

  const onRejectAppt = async () => {
    try {
      await rejectAppointment(ticket._id, rejectWhy || undefined);
      push("info", "Cita rechazada. Proponed otra franja.");
      setRejectWhy("");
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo rechazar la cita");
    }
  };

  const onComplete = async () => {
    try {
      await completeWork(ticket._id);
      push("success", "Trabajo marcado como completado");
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo completar el trabajo");
    }
  };

  const onClose = async () => {
    try {
      await closeTicket(ticket._id);
      push("success", "Incidencia cerrada");
      await reload();
    } catch (err: any) {
      showError(err, "No se pudo cerrar la incidencia");
    }
  };

  const onDispute = async () => {
    const reason = window.prompt("Motivo de disputa");
    if (reason) {
      try {
        await openDispute(ticket._id, reason);
        push("info", "Disputa abierta");
        await triggerEmail(
          "Se ha abierto una disputa",
          `El usuario ha abierto una disputa: ${reason}.`
        );
        await reload();
      } catch (err: any) {
        showError(err, "No se pudo abrir la disputa");
      }
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

          {role === "tenant" && can(["awaiting_schedule"]) && (
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div>
                <b>Responder a la cita propuesta</b>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <button onClick={onAcceptAppt}>Aceptar</button>
                <input placeholder="Motivo del rechazo (opcional)" value={rejectWhy} onChange={e=>setRejectWhy(e.target.value)} />
                <button onClick={onRejectAppt}>Rechazar</button>
              </div>
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

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <CopyLinkButton />
        </div>
        <ChatPanel kind="ticket" refId={ticket._id} />
      </div>
    </div>
  );
}

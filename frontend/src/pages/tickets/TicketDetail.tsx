import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTicket,
  assignPro,
  unassignPro,
  sendQuote,
  approveQuote,
  requestExtra,
  decideExtra,
  completeWork,
  validateTicket,
  resolveTicket,
} from "../../services/tickets";
import { proposeAppointment as proposeAppt, acceptAppointment, rejectAppointment } from "../../services/appointments";
import ChatPanel from "../../components/ChatPanel";
import ProPicker from "../../components/pro/ProPicker";
import ProReviewForm from "../../components/pro/ProReviewForm";
import { useAuth } from "../../context/AuthContext";
import { useNotify } from "../../utils/notify";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import StatusBadge from "../../components/ui/StatusBadge";
import PaymentModal from "../../components/payments/PaymentModal";
import { Calendar, User } from "lucide-react";
import {
  formatEuros,
  formatTicketDate,
  formatTicketDateTime,
  getHistoryLabel,
  getServiceLabel,
  getTicketErrorText,
  getTicketNextStep,
} from "../../utils/tickets";

/** Estados en los que el profesional trabaja (pagado y sin terminar), como WORK_STATUSES del backend. */
const WORK_STATUSES = ["awaiting_schedule", "scheduled", "in_progress"];

const sectionTitle = "text-sm font-semibold text-gray-900";
const panel = "space-y-3 rounded-lg border border-[var(--border)] bg-gray-50 p-3";

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [extraAmount, setExtraAmount] = useState<number>(0);
  const [extraReason, setExtraReason] = useState("");
  const [when, setWhen] = useState<string>("");
  const [showPayment, setShowPayment] = useState(false);

  const role = user?.role;
  const { push } = useNotify();

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTicket(id);
      setTicket(data);
    } catch (e) {
      push("error", "No se pudo cargar la incidencia");
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  useEffect(() => { reload(); }, [reload]);

  const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
    setBusy(true);
    try {
      await actionFn();
      push("success", successMsg);
      await reload();
    } catch (err: any) {
      push("error", getTicketErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando detalles...</div>;
  if (!ticket) return <div className="p-8 text-center text-red-600">Incidencia no encontrada</div>;

  const status: string = ticket.status;
  const paid = Boolean(ticket.escrowId);
  const working = paid && WORK_STATUSES.includes(status);
  const appointment = ticket.appointment as { start?: string; status?: string } | null;
  const appointmentProposed = appointment?.status === "proposed";
  const proName = ticket.pro?.displayName || "Profesional asignado";
  const nextStep = getTicketNextStep(ticket, role);
  const quoteAmount = formatEuros(ticket.quote?.amount);
  const history = (ticket.history || []).slice().reverse();

  const actions: React.ReactNode[] = [];

  // Propietario: elegir profesional mientras no haya presupuesto pagado
  if (role === "landlord" && !paid && ["open", "quoted"].includes(status)) {
    actions.push(
      ticket.proId ? (
        <div key="pro" className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-900">
            <User size={16} className="shrink-0 text-gray-400" aria-hidden="true" /> {ticket.pro?.profileId ? (
              <Link to={`/pros/${ticket.pro.profileId}`} className="truncate hover:underline">{proName}</Link>
            ) : (
              <span className="truncate">{proName}</span>
            )}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleAction(() => unassignPro(ticket._id), "Profesional retirado")}
            className="text-sm font-medium text-gray-600 underline-offset-2 hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <ProPicker
          key="pro"
          service={ticket.service}
          city={ticket.propertyCity}
          busy={busy}
          onAssign={proId => handleAction(() => assignPro(ticket._id, proId), "Profesional asignado")}
        />
      )
    );
  }

  if (role === "landlord" && status === "quoted" && ticket.quote && !paid) {
    actions.push(
      <div key="approve" className={panel}>
        <p className="text-sm text-gray-700">Presupuesto de {proName}: <strong className="tabular-nums text-gray-900">{quoteAmount}</strong></p>
        {ticket.quote.note && <p className="text-sm text-gray-600">{ticket.quote.note}</p>}
        <Button onClick={() => setShowPayment(true)} className="w-full">Aprobar y pagar</Button>
      </div>
    );
  }

  if (role === "landlord" && ticket.extra?.status === "pending") {
    actions.push(
      <div key="extra-decide" className={panel}>
        <p className="text-sm text-gray-700">Coste extra solicitado: <strong className="tabular-nums text-gray-900">{formatEuros(ticket.extra.amount)}</strong></p>
        {ticket.extra.reason && <p className="text-sm text-gray-600">{ticket.extra.reason}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => handleAction(() => decideExtra(ticket._id, "approved"), "Coste extra aprobado")} className="flex-1">Aprobar</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleAction(() => decideExtra(ticket._id, "rejected"), "Coste extra rechazado")} className="flex-1">Rechazar</Button>
        </div>
      </div>
    );
  }

  if (role === "landlord" && status === "awaiting_validation") {
    actions.push(
      <Button key="validate" disabled={busy} onClick={() => handleAction(() => validateTicket(ticket._id), "Trabajo validado y pago liberado")} className="w-full">
        Validar trabajo y liberar el pago
      </Button>
    );
  }

  // Profesional: presupuesto hasta que se pague
  if (role === "pro" && !paid && ["open", "quoted"].includes(status)) {
    actions.push(
      <div key="quote" className="space-y-3">
        <p className={sectionTitle}>{ticket.quote ? "Actualizar presupuesto" : "Enviar presupuesto"}</p>
        <div className="flex gap-2">
          <Input type="number" min={1} placeholder="€" aria-label="Importe en euros" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className="w-24" />
          <Input placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} className="flex-1" />
        </div>
        <Button onClick={() => handleAction(() => sendQuote(ticket._id, amount, note), "Presupuesto enviado")} disabled={!amount || busy} className="w-full">
          Enviar presupuesto
        </Button>
      </div>
    );
  }

  if (role === "pro" && paid && ["awaiting_schedule", "scheduled"].includes(status)) {
    actions.push(
      <div key="propose" className="space-y-3">
        <p className={`${sectionTitle} flex items-center gap-2`}>
          <Calendar size={16} aria-hidden="true" /> {appointment ? "Proponer otra fecha" : "Proponer cita"}
        </p>
        <input
          type="datetime-local"
          aria-label="Fecha y hora de la cita"
          className="w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <Button variant="secondary" onClick={() => handleAction(() => proposeAppt(ticket._id, when), "Cita propuesta")} disabled={!when || busy} className="w-full">
          Enviar propuesta
        </Button>
      </div>
    );
  }

  if (role === "pro" && working && !ticket.extra) {
    actions.push(
      <details key="extra" className="rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Solicitar un coste extra</summary>
        <div className="mt-3 space-y-3">
          <Input type="number" min={1} placeholder="Importe en €" value={extraAmount || ''} onChange={e => setExtraAmount(Number(e.target.value))} />
          <Input placeholder="Motivo" value={extraReason} onChange={e => setExtraReason(e.target.value)} />
          <Button variant="secondary" onClick={() => handleAction(() => requestExtra(ticket._id, extraAmount, extraReason), "Coste extra solicitado")} disabled={!extraAmount || busy} className="w-full">
            Solicitar
          </Button>
        </div>
      </details>
    );
  }

  if (role === "pro" && working) {
    actions.push(
      <Button key="complete" disabled={busy} onClick={() => handleAction(() => completeWork(ticket._id), "Trabajo marcado como terminado")} className="w-full">
        Marcar trabajo terminado
      </Button>
    );
  }

  // Inquilino: cita y confirmación final
  if (role === "tenant" && appointmentProposed && ["awaiting_schedule", "scheduled"].includes(status)) {
    actions.push(
      <div key="appointment" className={panel}>
        <p className="text-sm text-gray-700">Cita propuesta: <strong className="text-gray-900">{formatTicketDateTime(appointment?.start)}</strong></p>
        <div className="flex flex-col gap-2">
          <Button size="sm" disabled={busy} onClick={() => handleAction(() => acceptAppointment(ticket._id), "Cita aceptada")} className="w-full">Aceptar</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleAction(() => rejectAppointment(ticket._id), "Has pedido otra fecha")} className="w-full">Pedir otra fecha</Button>
        </div>
      </div>
    );
  }

  if (role === "tenant" && status === "awaiting_validation") {
    actions.push(
      <Button key="resolve" disabled={busy} onClick={() => handleAction(() => resolveTicket(ticket._id), "Incidencia cerrada")} className="w-full">
        Confirmar que está arreglado
      </Button>
    );
  }

  // Propietario o inquilino: valorar al profesional cuando la incidencia se cierra
  if (status === "closed" && ticket.proId && ticket.proReview && (ticket.proReview.canReview || ticket.proReview.mine)) {
    actions.push(
      <ProReviewForm
        key="review"
        ticketId={ticket._id}
        proUserId={ticket.proId}
        proName={proName}
        canReview={ticket.proReview.canReview}
        mine={ticket.proReview.mine}
        onSaved={async () => {
          push("success", "Gracias por tu opinión");
          await reload();
        }}
      />
    );
  }

  const facts: Array<[string, React.ReactNode]> = [
    ["Servicio", getServiceLabel(ticket.service)],
    ["Comunicada el", formatTicketDate(ticket.createdAt) || "—"],
  ];
  if (ticket.proId) facts.push(["Profesional", proName]);
  if (quoteAmount) facts.push(["Presupuesto", <span className="tabular-nums">{quoteAmount}{paid ? " · pagado" : ""}</span>]);
  if (appointment?.start) {
    facts.push([
      "Cita",
      `${formatTicketDateTime(appointment.start)}${appointment.status === "accepted" ? "" : appointment.status === "proposed" ? " (propuesta)" : " (pendiente de nueva fecha)"}`,
    ]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 [overflow-wrap:anywhere]">{ticket.title}</h1>
          <StatusBadge status={status} />
        </div>
        {nextStep && <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Siguiente paso:</span> {nextStep}</p>}
      </div>

      {/* En móvil las columnas se deshacen (contents) para ordenar: acciones, descripción, historial y chat. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="contents lg:col-span-2 lg:block lg:space-y-6">
          <Card className="order-2 p-5 lg:order-none">
            <h2 className={sectionTitle}>Descripción</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-700 [overflow-wrap:anywhere]">{ticket.description}</p>
            {Array.isArray(ticket.photos) && ticket.photos.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos de la avería">
                {ticket.photos.map((url: string, i: number) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-gray-50 hover:opacity-90"
                    >
                      <img src={url} alt={`Foto ${i + 1} de la avería`} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="order-4 h-[560px] overflow-hidden lg:order-none">
            <ChatPanel
              kind="direct"
              refId={role === 'landlord' || role === 'pro' ? ticket.openedBy : ticket.ownerId}
            />
          </div>
        </div>

        <div className="contents lg:block lg:space-y-6">
          <Card className="order-1 space-y-4 p-5 lg:order-none">
            <h2 className={sectionTitle}>Qué puedes hacer</h2>
            {actions.length > 0 ? actions : (
              <p className="text-sm text-gray-500">
                {status === "closed" ? "Esta incidencia está cerrada." : "Ahora no te toca hacer nada. Te avisaremos cuando cambie."}
              </p>
            )}
          </Card>

          {history.length > 0 && (
            <Card className="order-3 p-5 lg:order-none">
              <h2 className={sectionTitle}>Historial</h2>
              <ol className="mt-3 space-y-3 border-l border-gray-200 pl-4">
                {history.slice(0, 8).map((h: any, i: number) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />
                    <p className="text-sm text-gray-900">{getHistoryLabel(h.action)}</p>
                    <p className="text-xs text-gray-500">{formatTicketDateTime(h.ts || h.date)}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>

      {ticket.quote && (
        <PaymentModal
          open={showPayment}
          onClose={() => setShowPayment(false)}
          amountEUR={ticket.quote.amount}
          title="Aprobar presupuesto"
          description={`Vas a pagar la reparación: ${ticket.title}`}
          onSuccess={async () => {
            try {
              await approveQuote(ticket._id);
              setShowPayment(false);
              push("success", "Presupuesto aprobado y pagado");
              reload();
            } catch (err) {
              push("error", getTicketErrorText(err, "No se pudo aprobar el presupuesto"));
            }
          }}
        />
      )}
    </div>
  );
}

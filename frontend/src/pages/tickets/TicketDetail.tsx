import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "../../services/tickets";
import { proposeAppointment as proposeAppt, acceptAppointment, rejectAppointment } from "../../services/appointments";
import ChatPanel from "../../components/ChatPanel";
import { searchPros } from "../../services/pros";
import { useAuth } from "../../context/AuthContext";
import { useNotify } from "../../utils/notify";
import CopyLinkButton from "../../components/CopyLinkButton";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import {
  ArrowLeft, CheckCircle, AlertCircle, Wrench,
  User, MapPin, Calendar, MessageSquare
} from "lucide-react";

export default function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [pros, setPros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [extraAmount, setExtraAmount] = useState<number>(0);
  const [extraReason, setExtraReason] = useState("");
  const [when, setWhen] = useState<string>("");
  const [showProSearch, setShowProSearch] = useState(false);

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

  const can = (statuses: string[]) => statuses.includes(ticket?.status);

  const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
    try {
      await actionFn();
      push("success", successMsg);
      reload();
    } catch (err: any) {
      push("error", err?.response?.data?.error || "Error al realizar la acción");
    }
  };

  const loadPros = async () => {
    setShowProSearch(true);
    const list = await searchPros(ticket?.city, ticket?.service);
    setPros(list.items || []);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      open: "bg-blue-100 text-blue-800 border-blue-200",
      quoted: "bg-purple-100 text-purple-800 border-purple-200",
      in_progress: "bg-orange-100 text-orange-800 border-orange-200",
      awaiting_schedule: "bg-yellow-100 text-yellow-800 border-yellow-200",
      done: "bg-green-100 text-green-800 border-green-200",
      closed: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${styles[status] || styles.closed}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando detalles...</div>;
  if (!ticket) return <div className="p-8 text-center text-red-500">Incidencia no encontrada</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => nav(-1)} className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Wrench size={14}/> {ticket.service}</span>
              <span className="flex items-center gap-1"><MapPin size={14}/> {ticket.propertyAddress || "Ubicación desconocida"}</span>
              <span className="font-mono text-xs text-gray-400">#{ticket._id.slice(-6)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton />
          {(role === "landlord" || role === "tenant") && can(["done"]) && (
             <Button variant="secondary" onClick={() => handleAction(() => closeTicket(ticket._id), "Incidencia cerrada")}>
               Cerrar Incidencia
             </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-6">

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Descripción del problema</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
          </Card>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-[600px] flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <MessageSquare size={18} className="text-gray-500"/>
              <span className="font-semibold text-gray-700">Actividad y Comentarios</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel kind="ticket" refId={ticket._id} />
            </div>
          </div>
        </div>

        <div className="space-y-6">

          <Card className="p-5 border-l-4 border-l-blue-500 shadow-md">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="text-blue-500" size={20}/> Acciones Requeridas
            </h3>

            {role === "landlord" && can(["open", "quoted", "awaiting_schedule"]) && (
              <div className="space-y-4">
                {!ticket.pro ? (
                  <>
                    <p className="text-sm text-gray-600">No hay profesional asignado.</p>
                    <Button onClick={loadPros} className="w-full">Buscar Profesional</Button>
                    {showProSearch && (
                      <div className="mt-4 space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-gray-50">
                        {pros.length === 0 && <p className="text-xs text-gray-500 text-center">No se encontraron profesionales cercanos.</p>}
                        {pros.map(pro => (
                          <div key={pro._id} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                            <div className="flex-1 truncate pr-2">
                              <span className="font-medium block">{pro.displayName}</span>
                              <span className="text-xs text-gray-500">{pro.city}</span>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => handleAction(() => assignPro(ticket._id, pro._id), "Profesional asignado")}>Asignar</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-blue-600"/>
                      <span className="text-sm font-medium text-blue-900">{ticket.pro.displayName}</span>
                    </div>
                    <button onClick={() => handleAction(() => unassignPro(ticket._id), "Desasignado")} className="text-xs text-red-600 hover:underline">Cambiar</button>
                  </div>
                )}
              </div>
            )}

            {role === "pro" && can(["open"]) && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Enviar Presupuesto</p>
                <div className="flex gap-2">
                  <Input type="number" placeholder="€" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className="w-24"/>
                  <Input placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} className="flex-1"/>
                </div>
                <Button onClick={() => handleAction(() => sendQuote(ticket._id, amount, note), "Presupuesto enviado")} disabled={!amount} className="w-full">Enviar Cotización</Button>
              </div>
            )}

            {role === "landlord" && can(["quoted"]) && ticket.quote && (
              <div className="space-y-3 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                <p className="text-sm text-yellow-800">Presupuesto recibido: <strong>{ticket.quote.amount}€</strong></p>
                {ticket.quote.note && <p className="text-xs text-yellow-700 italic">"{ticket.quote.note}"</p>}
                <Button onClick={() => handleAction(() => approveQuote(ticket._id), "Presupuesto aprobado")} className="w-full">Aprobar y Pagar</Button>
              </div>
            )}

            {role === "pro" && can(["in_progress", "awaiting_approval"]) && !ticket.extra && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <p className="text-sm font-medium text-gray-700">Solicitar Extra</p>
                <Input type="number" placeholder="Importe €" value={extraAmount || ''} onChange={e => setExtraAmount(Number(e.target.value))} />
                <Input placeholder="Motivo" value={extraReason} onChange={e => setExtraReason(e.target.value)} />
                <Button variant="secondary" onClick={() => handleAction(() => requestExtra(ticket._id, extraAmount, extraReason), "Extra solicitado")} disabled={!extraAmount} className="w-full">Solicitar</Button>
              </div>
            )}

            {role === "landlord" && ticket.extra?.status === "pending" && (
              <div className="space-y-3 bg-orange-50 p-3 rounded-lg border border-orange-100 mt-4">
                <p className="text-sm text-orange-800 font-bold">Solicitud de Extra: {ticket.extra.amount}€</p>
                <p className="text-xs text-orange-700">{ticket.extra.reason}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAction(() => decideExtra(ticket._id, "approved"), "Extra Aprobado")} className="flex-1 bg-green-600 hover:bg-green-700">Aprobar</Button>
                  <Button size="sm" variant="danger" onClick={() => handleAction(() => decideExtra(ticket._id, "rejected"), "Extra Rechazado")} className="flex-1">Rechazar</Button>
                </div>
              </div>
            )}

            {can(["quoted", "awaiting_schedule", "in_progress"]) && !ticket.appointment && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><Calendar size={16}/> Proponer Cita</p>
                <input
                  type="datetime-local"
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
                <Button variant="secondary" onClick={() => handleAction(() => proposeAppt(ticket._id, when), "Cita propuesta")} disabled={!when} className="w-full">Enviar Propuesta</Button>
              </div>
            )}

            {role === "tenant" && can(["awaiting_schedule"]) && ticket.appointment && !ticket.appointment.confirmed && (
              <div className="mt-4 bg-blue-50 p-3 rounded space-y-2">
                <p className="text-sm font-medium text-blue-900">Propuesta: {new Date(ticket.appointment.date).toLocaleString()}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAction(() => acceptAppointment(ticket._id), "Cita aceptada")} className="flex-1">Aceptar</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction(() => rejectAppointment(ticket._id), "Cita rechazada")} className="flex-1 text-red-600">Rechazar</Button>
                </div>
              </div>
            )}

            {role === "pro" && can(["in_progress"]) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button size="lg" onClick={() => handleAction(() => completeWork(ticket._id), "Trabajo completado")} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg">
                  <CheckCircle size={20} className="mr-2"/> Marcar Completado
                </Button>
              </div>
            )}

            {ticket.status === 'closed' && (
              <p className="text-sm text-gray-500 italic text-center py-4">Esta incidencia está cerrada.</p>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-4 bg-gray-50 border-gray-200">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Historial</h4>
              <div className="space-y-3 pl-2 border-l-2 border-gray-200">
                {ticket.history?.slice().reverse().slice(0, 5).map((h: any, i: number) => (
                  <div key={i} className="relative pl-4">
                    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-gray-300"></div>
                    <p className="text-xs text-gray-800 font-medium">{h.action}</p>
                    <p className="text-[10px] text-gray-500">{new Date(h.ts || h.date).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

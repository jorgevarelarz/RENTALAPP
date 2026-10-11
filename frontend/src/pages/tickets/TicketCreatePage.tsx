import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createTicket } from "../../services/tickets";
import { listContracts } from "../../services/contracts";
import { useAuth } from "../../context/AuthContext";
import { useNotify } from "../../utils/notify";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import {
  TICKET_DESCRIPTION_MAX,
  TICKET_SERVICES,
  TICKET_TITLE_MAX,
  getServiceLabel,
  getTicketErrorText,
} from "../../utils/tickets";

const fieldClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none';
const primaryButton =
  'inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-60';
const secondaryLink =
  'inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50';

type Home = { id: string; title: string; address: string };

/** Vivienda de un contrato: título del anuncio y dirección, si vienen poblados. */
function toHome(c: any): Home {
  const property = c?.property && typeof c.property === 'object' ? c.property : null;
  const address = [property?.address, property?.city].filter(Boolean).join(', ');
  return {
    id: String(c._id),
    title: property?.title || address || c.propertyAddress || 'Vivienda alquilada',
    address: property?.title ? address : '',
  };
}

export default function TicketCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { push } = useNotify();
  const [contractId, setContractId] = useState("");
  const [service, setService] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contracts", "active-for-ticket"],
    queryFn: () => listContracts(token as string, { status: 'active' }),
    enabled: Boolean(token),
  });
  const homes = useMemo(() => (data?.items || []).map(toHome), [data]);

  // Con un solo contrato activo no hay nada que elegir
  useEffect(() => {
    if (homes.length === 1) setContractId(homes[0].id);
  }, [homes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId) return setError('Elige la vivienda.');
    if (!service) return setError('Elige el tipo de avería.');
    if (!title.trim()) return setError('Pon un título a la avería.');
    if (!description.trim()) return setError('Describe qué pasa.');
    setSending(true);
    setError(null);
    try {
      const ticket = await createTicket({ contractId, service, title: title.trim(), description: description.trim() });
      push("success", "Avería comunicada. Hemos avisado a tu arrendador.");
      navigate(`/tickets/${ticket._id}`);
    } catch (err) {
      setError(getTicketErrorText(err, 'No se pudo comunicar la avería. Inténtalo de nuevo.'));
      setSending(false);
    }
  };

  const header = (
    <PageHeader
      title="Comunicar una avería"
      subtitle="Tu arrendador recibe un aviso por correo y elige un profesional para arreglarla."
    />
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        {header}
        <Card className="px-5 py-6 text-sm text-gray-500">Cargando tu contrato…</Card>
      </div>
    );
  }

  if (isError || homes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        {header}
        <Card className="space-y-3 px-5 py-6">
          <p className="font-medium text-gray-900">
            {isError ? 'No se pudo cargar tu contrato' : 'No tienes ningún alquiler activo'}
          </p>
          <p className="text-sm text-gray-500">
            {isError
              ? 'Vuelve a intentarlo en un momento.'
              : 'Las averías se comunican desde un contrato activo. Cuando tu contrato empiece, podrás hacerlo aquí.'}
          </p>
          <Link to="/contracts" className={secondaryLink}>Ver mis contratos</Link>
        </Card>
      </div>
    );
  }

  const selectedHome = homes.find(h => h.id === contractId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      {header}
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} noValidate className="space-y-6">
          {homes.length === 1 && selectedHome ? (
            <div>
              <p className="text-sm font-medium text-gray-900">Vivienda</p>
              <p className="mt-1 text-sm text-gray-700">{selectedHome.title}</p>
              {selectedHome.address && <p className="text-sm text-gray-500">{selectedHome.address}</p>}
            </div>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-900">Vivienda</span>
              <select value={contractId} onChange={e => setContractId(e.target.value)} className={fieldClass}>
                <option value="">Elige la vivienda</option>
                {homes.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.address ? `${h.title} · ${h.address}` : h.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-gray-900">Tipo de avería</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TICKET_SERVICES.map(key => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={service === key}
                  onClick={() => setService(key)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    service === key
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-[var(--border)] bg-[var(--card)] text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {getServiceLabel(key)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-900">Título</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={TICKET_TITLE_MAX}
              placeholder="Por ejemplo: gotea el grifo de la cocina"
              className={fieldClass}
            />
          </label>

          <div className="space-y-1.5">
            <label htmlFor="ticket-description" className="block text-sm font-medium text-gray-900">Qué pasa</label>
            <textarea
              id="ticket-description"
              aria-describedby="ticket-description-help"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={TICKET_DESCRIPTION_MAX}
              rows={5}
              placeholder="Desde cuándo pasa, en qué parte de la casa y qué has probado."
              className={`${fieldClass} resize-y`}
            />
            <p id="ticket-description-help" className="flex justify-between gap-3 text-xs text-gray-500">
              <span>Indica también cuándo puede entrar el profesional.</span>
              <span className="tabular-nums">{description.length}/{TICKET_DESCRIPTION_MAX}</span>
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link to="/tickets" className={secondaryLink}>Cancelar</Link>
            <button type="submit" disabled={sending} className={primaryButton}>
              {sending ? 'Enviando…' : 'Comunicar avería'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

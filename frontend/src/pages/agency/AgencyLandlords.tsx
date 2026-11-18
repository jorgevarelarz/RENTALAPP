import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';
import {
  createLandlordInvite,
  listLandlordInvites,
  resendLandlordInvite,
  type LandlordInviteItem,
  type LandlordInviteResult,
} from '../../services/agency';
import { formatApiError } from '../../api/client';
import Badge from '../../components/ui/Badge';
import type { StatusTone } from '../../utils/statusBadges';

const STEP_LABELS: Array<{ key: keyof LandlordInviteItem['steps']; label: string }> = [
  { key: 'accountCreated', label: 'Cuenta creada' },
  { key: 'kycVerified', label: 'DNI verificado' },
  { key: 'hasProperty', label: 'Propiedad publicada' },
  { key: 'hasActiveContract', label: 'Contrato activo' },
];

const RESEND_ERRORS: Record<string, string> = {
  resend_too_soon: 'Ya se envió hace poco. Podrás reenviarla dentro de unos minutos.',
  invite_not_pending: 'Ese propietario ya activó su cuenta.',
  landlord_already_exists: 'Ese email ya tiene cuenta en RentalApp.',
  landlord_already_invited: 'Otro colaborador ya invitó a ese propietario.',
};

/** Un backend antiguo no manda emailStatus: se da por enviado. */
const delivered = (r: LandlordInviteResult) => r.emailStatus === undefined || r.emailStatus === 'sent';

type Notice = { tone: 'success' | 'warning' | 'error'; text: React.ReactNode };

const NOTICE_CLS: Record<Notice['tone'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

function StatusBadge({ status }: { status: LandlordInviteItem['status'] }) {
  const map: Record<LandlordInviteItem['status'], [string, StatusTone]> = {
    invited: ['Invitado', 'warning'],
    accepted: ['Activo', 'success'],
    expired: ['Caducada', 'neutral'],
  };
  const [label, tone] = map[status] || map.invited;
  return <Badge tone={tone}>{label}</Badge>;
}

export default function AgencyLandlords() {
  const [items, setItems] = useState<LandlordInviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ landlordName: '', landlordEmail: '', landlordPhone: '', propertyAddress: '' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const sentNotice = (result: LandlordInviteResult, resent: boolean): Notice =>
    delivered(result)
      ? {
          tone: 'success',
          text: (
            <>
              Invitación {resent ? 'reenviada' : 'enviada'} a <strong className="font-semibold">{result.landlordEmail}</strong>. El enlace de activación solo le llega a esa dirección y caduca en 30 días.
            </>
          ),
        }
      : {
          tone: 'warning',
          text: (
            <>
              Invitación guardada, pero el correo a <strong className="font-semibold">{result.landlordEmail}</strong> no salió. Reenvíala desde la lista en unos minutos.
            </>
          ),
        };

  const load = async () => {
    try {
      setItems(await listLandlordInvites());
    } catch {} finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const invite = await createLandlordInvite({
        landlordName: form.landlordName,
        landlordEmail: form.landlordEmail,
        landlordPhone: form.landlordPhone || undefined,
        propertyAddress: form.propertyAddress || undefined,
      });
      setNotice(sentNotice(invite, false));
      setForm({ landlordName: '', landlordEmail: '', landlordPhone: '', propertyAddress: '' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      const code = e?.response?.data?.error;
      const msgs: Record<string, string> = {
        landlord_already_exists: 'Ese email ya tiene cuenta en RentalApp.',
        invite_already_pending: 'Ya tienes una invitación pendiente para ese email.',
        landlord_already_invited: 'Otro colaborador ya invitó a ese propietario.',
      };
      setErr(msgs[code] || formatApiError(e, 'No se pudo crear la invitación'));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async (item: LandlordInviteItem) => {
    setResending(item.id);
    try {
      setNotice(sentNotice(await resendLandlordInvite(item.id), true));
      await load();
    } catch (e: any) {
      const code = e?.response?.data?.error;
      setNotice({ tone: 'error', text: RESEND_ERRORS[code] || formatApiError(e, 'No se pudo reenviar la invitación') });
    } finally {
      setResending(null);
    }
  };

  return (
    <div className="py-2 grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">Propietarios</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Da de alta a tus propietarios y cobra comisión mientras sus contratos operen en RentalApp.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setErr(null); setNotice(null); }}
          className="inline-flex items-center gap-2 bg-gray-950 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800"
        >
          <Plus size={16} /> Dar de alta propietario
        </button>
      </div>

      {notice && (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${NOTICE_CLS[notice.tone]}`}>
          {notice.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-5 grid gap-3 max-w-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-950">Nuevo propietario</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700 grid gap-1.5">
              Nombre completo
              <input required minLength={2} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                value={form.landlordName} onChange={(e) => setForm({ ...form, landlordName: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-gray-700 grid gap-1.5">
              Email
              <input required type="email" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                value={form.landlordEmail} onChange={(e) => setForm({ ...form, landlordEmail: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-gray-700 grid gap-1.5">
              Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                value={form.landlordPhone} onChange={(e) => setForm({ ...form, landlordPhone: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-gray-700 grid gap-1.5">
              Dirección del inmueble <span className="text-gray-400 font-normal">(opcional)</span>
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                value={form.propertyAddress} onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })} />
            </label>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <p className="text-xs text-gray-500">
            El propietario recibirá un email para activar su cuenta, aceptar las condiciones y verificar su identidad. La atribución de captación queda registrada a tu nombre.
          </p>
          <div>
            <button disabled={submitting} className="bg-gray-950 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-400">
              {submitting ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="font-semibold text-gray-900">Aún no has dado de alta a ningún propietario</p>
          <p className="mt-1 text-sm text-gray-500">Cada propietario que actives genera comisión recurrente para tu agencia.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="min-w-0 md:w-64">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-950 truncate">{item.landlordName}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm text-gray-500 truncate">{item.landlordEmail}</p>
                {item.propertyAddress && <p className="text-xs text-gray-400 truncate">{item.propertyAddress}</p>}
                {item.status !== 'accepted' && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    {item.emailFailed && <span className="font-medium text-amber-700">No se pudo enviar el correo</span>}
                    <button
                      type="button"
                      onClick={() => resend(item)}
                      disabled={resending === item.id}
                      aria-label={`Reenviar invitación a ${item.landlordEmail}`}
                      className="font-semibold text-[var(--ra-blue)] hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline"
                    >
                      {resending === item.id ? 'Enviando…' : 'Reenviar invitación'}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 md:ml-auto">
                {STEP_LABELS.map(({ key, label }) => {
                  const done = item.steps[key];
                  return (
                    <span key={key} className={`inline-flex items-center gap-1.5 text-xs font-medium ${done ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Copy, Plus, X } from 'lucide-react';
import {
  createLandlordInvite,
  listLandlordInvites,
  type LandlordInviteItem,
} from '../../services/agency';
import { formatApiError } from '../../api/client';

const STEP_LABELS: Array<{ key: keyof LandlordInviteItem['steps']; label: string }> = [
  { key: 'accountCreated', label: 'Cuenta creada' },
  { key: 'kycVerified', label: 'DNI verificado' },
  { key: 'hasProperty', label: 'Propiedad publicada' },
  { key: 'hasActiveContract', label: 'Contrato activo' },
];

function StatusBadge({ status }: { status: LandlordInviteItem['status'] }) {
  const map = {
    invited: ['Invitado', 'bg-amber-50 text-amber-700 border-amber-200'],
    accepted: ['Activo', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
    expired: ['Caducada', 'bg-gray-100 text-gray-500 border-gray-200'],
  } as const;
  const [label, cls] = map[status] || map.invited;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{label}</span>;
}

export default function AgencyLandlords() {
  const [items, setItems] = useState<LandlordInviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ landlordName: '', landlordEmail: '', landlordPhone: '', propertyAddress: '' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setLastInviteUrl(invite.inviteUrl);
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

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
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
          onClick={() => { setShowForm(true); setErr(null); }}
          className="inline-flex items-center gap-2 bg-gray-950 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800"
        >
          <Plus size={16} /> Dar de alta propietario
        </button>
      </div>

      {lastInviteUrl && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>Invitación enviada por email. También puedes compartir el enlace directamente.</span>
          <button onClick={() => copyLink(lastInviteUrl)} className="inline-flex items-center gap-1.5 font-semibold hover:underline shrink-0">
            <Copy size={14} /> {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
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

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { createContract } from '../../services/contracts';
import { getProperty } from '../../services/properties';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  buildContractPayload,
  contractCreateError,
  contractEndDate,
  contractRegion,
  ContractDraft,
  DEPOSIT_BODY,
  DraftProperty,
  SUPPORTED_REGIONS,
} from './contractDraft';

// Estado con el que llega desde «Crear contrato» en los candidatos de un inmueble (ApplicantsModal)
type WizardState = {
  propertyId?: string;
  tenantId?: string;
  initialData?: {
    address?: string;
    city?: string;
    rentAmount?: number;
    depositAmount?: number;
    tenantName?: string;
    tenantEmail?: string;
  };
};

type LoadedProperty = DraftProperty & { title?: string; address?: string; city?: string };

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const formatEuros = (value: number) => euroFormatter.format(Number(value) || 0);
const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};
const tomorrow = () => {
  const d = new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STEPS = ['Condiciones', 'Cláusulas', 'Revisar'];
const SELECT = 'auth-input';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6 border-b border-gray-100 last:border-0">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 sm:text-right [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--ra-blue)]"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="block font-medium text-gray-900">{label}</span>
          <span className="block text-sm text-gray-500">{hint}</span>
        </span>
      </label>
      {children}
    </div>
  );
}

export default function ContractWizard() {
  const location = useLocation();
  const state = (location.state || null) as WizardState | null;
  const nav = useNavigate();
  const { push } = useToast();

  const propertyId = state?.propertyId || '';
  const tenantId = state?.tenantId || '';
  const tenantName = state?.initialData?.tenantName || '';
  const tenantEmail = state?.initialData?.tenantEmail || '';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState<LoadedProperty | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<ContractDraft>(() => {
    const rent = Number(state?.initialData?.rentAmount) || 0;
    return {
      startDate: tomorrow(),
      durationYears: 1,
      rent,
      deposit: Number(state?.initialData?.depositAmount) || rent,
      petsAllowed: false,
      petsLimit: 1,
      sublettingAllowed: false,
      professionalUse: false,
      graceDays: 5,
    };
  });

  useEffect(() => {
    if (!propertyId) return;
    let alive = true;
    getProperty(propertyId)
      .then((p) => alive && setProperty(p as LoadedProperty))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [propertyId]);

  const set = <K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const region = contractRegion(property?.region);
  const endDate = contractEndDate(draft.startDate, draft.durationYears);
  const address =
    [property?.address || state?.initialData?.address, property?.city || state?.initialData?.city]
      .filter(Boolean)
      .join(', ') || property?.title || 'Inmueble';

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!draft.startDate || !endDate) return 'Indica la fecha de inicio.';
      if (!(draft.rent > 0)) return 'La renta mensual tiene que ser mayor que 0 €.';
      if (draft.deposit < 0) return 'La fianza no puede ser negativa.';
    }
    return null;
  }, [step, draft, endDate]);

  if (!propertyId || !tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Nuevo contrato</h1>
        <Card className="p-6">
          <p className="text-gray-700">
            Los contratos se preparan a partir de un candidato. Abre los candidatos de uno de tus inmuebles y pulsa
            «Crear contrato» junto a la persona elegida.
          </p>
          <Link to="/landlord" className="inline-block mt-4 font-semibold text-[var(--ra-blue)] hover:underline">
            Ir a mis inmuebles
          </Link>
        </Card>
      </div>
    );
  }

  const next = () => {
    if (stepError) {
      push({ title: stepError, tone: 'error' });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    if (!property || !region) return;
    setSaving(true);
    try {
      const contract: any = await createContract(buildContractPayload(draft, property, tenantId));
      push({ title: 'Contrato creado. Queda pendiente de la firma del inquilino.', tone: 'success' });
      const id = contract?._id || contract?.id;
      nav(id ? `/contracts/${id}` : '/landlord');
    } catch (e) {
      push({ title: contractCreateError(e), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo contrato de alquiler</h1>
        <p className="text-gray-500 mt-1 [overflow-wrap:anywhere]">
          {address}
          {tenantName ? ` · con ${tenantName}` : ''}
        </p>
        <ol className="mt-6 flex gap-6 border-b border-gray-200 text-sm" aria-label="Pasos">
          {STEPS.map((title, i) => (
            <li
              key={title}
              aria-current={i === step ? 'step' : undefined}
              className={`-mb-px pb-3 border-b-2 ${
                i === step
                  ? 'border-[var(--ra-blue)] font-semibold text-gray-900'
                  : i < step
                    ? 'border-transparent text-gray-700'
                    : 'border-transparent text-gray-400'
              }`}
            >
              {title}
            </li>
          ))}
        </ol>
      </header>

      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          No se pudo cargar el inmueble. Vuelve a intentarlo desde tus inmuebles.
        </p>
      )}
      {property && !region && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Todavía no generamos contratos para inmuebles en «{property.region || 'sin comunidad'}». Por ahora:{' '}
          {Object.values(SUPPORTED_REGIONS).join(', ')}.
        </p>
      )}

      <Card className="p-6">
        {step === 0 && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Fecha de inicio"
                type="date"
                value={draft.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Duración</span>
                <select
                  className={SELECT}
                  value={draft.durationYears}
                  onChange={(e) => set('durationYears', Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      {y} {y > 1 ? 'años' : 'año'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm text-gray-500">Termina el {formatDate(endDate)}. Después se prorroga por años.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Renta mensual (€)"
                type="number"
                min={0}
                step="0.01"
                value={draft.rent || ''}
                onChange={(e) => set('rent', Number(e.target.value))}
              />
              <Input
                label="Fianza (€)"
                type="number"
                min={0}
                step="0.01"
                value={draft.deposit || ''}
                onChange={(e) => set('deposit', Number(e.target.value))}
              />
            </div>
            <p className="text-sm text-gray-500">La ley fija para vivienda una fianza de una mensualidad.</p>
          </section>
        )}

        {step === 1 && (
          <section>
            <Toggle
              checked={draft.petsAllowed}
              onChange={(v) => set('petsAllowed', v)}
              label="Se permiten mascotas"
              hint="El inquilino responde de los daños y la limpieza."
            >
              {draft.petsAllowed && (
                <label className="mt-3 ml-7 flex items-center gap-3 text-sm text-gray-700">
                  Hasta
                  <select
                    className={SELECT}
                    style={{ width: 'auto' }}
                    value={draft.petsLimit}
                    onChange={(e) => set('petsLimit', Number(e.target.value))}
                    aria-label="Número máximo de mascotas"
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {draft.petsLimit > 1 ? 'animales' : 'animal'}
                </label>
              )}
            </Toggle>
            <Toggle
              checked={draft.sublettingAllowed}
              onChange={(v) => set('sublettingAllowed', v)}
              label="Se permite subarrendar"
              hint="Siempre con tu autorización previa y por escrito."
            />
            <Toggle
              checked={draft.professionalUse}
              onChange={(v) => set('professionalUse', v)}
              label="Se permite actividad profesional"
              hint="Sin atención al público. Si no, la vivienda es solo para vivir."
            />
            <div className="py-4">
              <label className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                <span className="font-medium text-gray-900">Días de margen para pagar la renta</span>
                <select
                  className={SELECT}
                  style={{ width: 'auto' }}
                  value={draft.graceDays}
                  onChange={(e) => set('graceDays', Number(e.target.value))}
                >
                  {[0, 3, 5, 7, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <dl>
              <Row label="Inmueble">{address}</Row>
              <Row label="Inquilino">
                {tenantName || 'Candidato seleccionado'}
                {tenantEmail && <span className="block text-gray-500 font-normal">{tenantEmail}</span>}
              </Row>
              <Row label="Duración">
                {formatDate(draft.startDate)} – {formatDate(endDate)}
              </Row>
              <Row label="Renta mensual">{formatEuros(draft.rent)}</Row>
              <Row label="Fianza">{formatEuros(draft.deposit)}</Row>
              <Row label="Mascotas">
                {draft.petsAllowed ? `Sí, hasta ${draft.petsLimit}` : 'No, salvo autorización por escrito'}
              </Row>
              <Row label="Subarriendo">{draft.sublettingAllowed ? 'Con autorización previa' : 'No'}</Row>
              <Row label="Uso">{draft.professionalUse ? 'Vivienda y actividad profesional' : 'Solo vivienda'}</Row>
              <Row label="Margen de pago">
                {draft.graceDays} {draft.graceDays === 1 ? 'día' : 'días'}
              </Row>
              {region && <Row label="Depósito de la fianza">En {DEPOSIT_BODY[region]}</Row>}
            </dl>
            <p className="mt-4 text-sm text-gray-500">
              Al crearlo generamos el PDF y avisamos al inquilino por correo para que lo revise y lo firme.
            </p>
          </section>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
            className="inline-flex items-center gap-2"
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Atrás
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} className="inline-flex items-center gap-2">
              Siguiente <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving || !property || !region}>
              {saving ? 'Creando contrato…' : 'Crear contrato'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

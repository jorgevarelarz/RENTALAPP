import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProProfile, saveProProfile, type ProProfile } from '../../services/pro';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';
import { TICKET_SERVICES, getServiceLabel } from '../../utils/tickets';

/** Mensajes de los errores de POST /api/pros. */
const SAVE_ERRORS: Record<string, string> = {
  invalid_display_name: 'El nombre comercial debe tener entre 2 y 80 caracteres.',
  invalid_city: 'La ciudad debe tener entre 2 y 60 caracteres.',
  invalid_services: 'Revisa los servicios: el precio orientativo va de 0 a 100.000 €.',
};

type FormState = { displayName: string; city: string; active: boolean; prices: Record<string, string>; selected: string[] };

const emptyForm: FormState = { displayName: '', city: '', active: true, prices: {}, selected: [] };

function toForm(pro: ProProfile | null): FormState {
  if (!pro) return emptyForm;
  return {
    displayName: pro.displayName || '',
    city: pro.city || '',
    active: pro.active !== false,
    selected: (pro.services || []).map(s => s.key),
    prices: Object.fromEntries((pro.services || []).filter(s => s.basePrice != null).map(s => [s.key, String(s.basePrice)])),
  };
}

const parsePrice = (value: string) => {
  const text = value.trim().replace(',', '.');
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? n : NaN;
};

export default function ProProfilePage() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { data: pro, isLoading, isError } = useQuery({ queryKey: ['pro/me'], queryFn: getMyProProfile });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pro !== undefined) setForm(toForm(pro));
  }, [pro]);

  const save = useMutation({
    mutationFn: saveProProfile,
    onSuccess: saved => {
      queryClient.setQueryData(['pro/me'], saved);
      setError('');
      push({ title: pro ? 'Perfil guardado' : 'Perfil creado: ya pueden asignarte trabajos', tone: 'success' });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error;
      setError(SAVE_ERRORS[code] || 'No se pudo guardar el perfil. Vuelve a intentarlo en un momento.');
    },
  });

  const toggle = (key: string) =>
    setForm(f => ({ ...f, selected: f.selected.includes(key) ? f.selected.filter(k => k !== key) : [...f.selected, key] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = form.displayName.trim();
    const city = form.city.trim();
    if (displayName.length < 2) return setError(SAVE_ERRORS.invalid_display_name);
    if (city.length < 2) return setError(SAVE_ERRORS.invalid_city);
    if (!form.selected.length) return setError('Elige al menos un servicio.');
    const services = TICKET_SERVICES.filter(key => form.selected.includes(key)).map(key => ({
      key,
      basePrice: parsePrice(form.prices[key] || ''),
    }));
    const bad = services.find(s => Number.isNaN(s.basePrice));
    if (bad) return setError(`El precio orientativo de ${getServiceLabel(bad.key).toLowerCase()} debe ser un número entre 0 y 100.000 €.`);
    setError('');
    save.mutate({ displayName, city, services, active: form.active });
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Perfil profesional"
        subtitle="Lo que ven los propietarios cuando buscan a alguien para una avería."
        cta={pro && pro.active && (
          <Link to={`/pros/${pro._id}`} className="text-sm font-medium text-[var(--primary)] hover:underline">
            Ver perfil público
          </Link>
        )}
      />

      {isLoading ? (
        <Card className="px-5 py-6 text-sm text-gray-500">Cargando perfil…</Card>
      ) : isError ? (
        <Card className="px-5 py-6 text-sm text-red-700">No se pudo cargar tu perfil. Vuelve a intentarlo en un momento.</Card>
      ) : (
        <form onSubmit={submit} noValidate>
          <Card className="divide-y divide-gray-100">
            <section className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <Input
                label="Nombre comercial"
                value={form.displayName}
                maxLength={80}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="Reformas García"
                autoComplete="organization"
              />
              <Input
                label="Ciudad donde trabajas"
                value={form.city}
                maxLength={60}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Madrid"
                autoComplete="address-level2"
              />
            </section>

            <section role="group" aria-labelledby="pro-services" className="px-5 py-5">
              <h2 id="pro-services" className="text-sm font-semibold text-gray-900">Servicios</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                El precio orientativo es opcional: sale como «desde» en tu perfil público. El presupuesto de cada trabajo lo envías aparte.
              </p>
              <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-[var(--border)]">
                {TICKET_SERVICES.map(key => {
                  const active = form.selected.includes(key);
                  const label = getServiceLabel(key);
                  return (
                    <li key={key} className="flex min-h-[52px] items-center justify-between gap-3 px-3 py-2">
                      <label className="flex flex-1 cursor-pointer select-none items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggle(key)}
                          className="h-4 w-4 rounded border-gray-300 accent-[var(--primary)]"
                        />
                        <span className={active ? 'font-medium text-gray-900' : 'text-gray-600'}>{label}</span>
                      </label>
                      {active && (
                        <label className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="hidden sm:inline">Desde</span>
                          <span className="relative">
                            <input
                              inputMode="decimal"
                              aria-label={`Precio orientativo de ${label.toLowerCase()} (€)`}
                              value={form.prices[key] || ''}
                              onChange={e => setForm(f => ({ ...f, prices: { ...f.prices, [key]: e.target.value } }))}
                              placeholder="—"
                              className="w-24 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1.5 pl-3 pr-7 text-right tabular-nums text-gray-900 focus:border-gray-400 focus:outline-none"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                          </span>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="px-5 py-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Visible para propietarios</span>
                  <span className="block text-sm text-gray-500">
                    Si lo desmarcas, dejas de salir en el directorio y no pueden asignarte trabajos nuevos. Los que ya tienes siguen igual.
                  </span>
                </span>
              </label>
            </section>

            <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              {error && <p role="alert" className="text-sm text-red-700 sm:mr-auto">{error}</p>}
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {save.isPending ? 'Guardando…' : pro ? 'Guardar cambios' : 'Crear perfil'}
              </button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}

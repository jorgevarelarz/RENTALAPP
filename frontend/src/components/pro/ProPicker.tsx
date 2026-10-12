import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPros } from '../../services/pros';
import Button from '../ui/Button';
import { getServiceLabel } from '../../utils/tickets';
import { proPriceText, proRatingText } from '../../utils/pros';

type Props = {
  service?: string;
  /** Ciudad del inmueble: se busca ahí primero. */
  city?: string;
  busy: boolean;
  onAssign: (proProfileId: string) => void;
};

/** Elegir profesional para una incidencia: primero los del servicio en la ciudad del inmueble, y si no hay, de otras. */
export default function ProPicker({ service, city, busy, onAssign }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [pros, setPros] = useState<any[]>([]);
  const [scope, setScope] = useState<string | undefined>(city);

  const load = async (inCity?: string) => {
    setScope(inCity);
    setState('loading');
    try {
      const list = await searchPros(inCity, service);
      setPros(list.items || []);
      setState('done');
    } catch {
      setPros([]);
      setState('error');
    }
  };

  if (state === 'idle') {
    return <Button onClick={() => load(city)} className="w-full">Buscar profesional</Button>;
  }

  const where = scope ? ` en ${scope}` : '';
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-900">
        {getServiceLabel(service)}{where}
      </p>
      {state === 'loading' && <p className="text-sm text-gray-500">Buscando profesionales…</p>}
      {state === 'error' && (
        <p className="text-sm text-red-700">
          No se pudo cargar la lista.{' '}
          <button type="button" onClick={() => load(scope)} className="font-medium underline-offset-2 hover:underline">Reintentar</button>
        </p>
      )}
      {state === 'done' && pros.length === 0 && (
        <p className="text-sm text-gray-500">
          {scope ? `Nadie ofrece ${getServiceLabel(service).toLowerCase()}${where} todavía.` : 'Todavía no hay profesionales para este servicio.'}
        </p>
      )}
      {state === 'done' && pros.length > 0 && (
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-[var(--border)]">
          {pros.map(pro => {
            const details = [scope ? null : pro.city, proPriceText(pro, service), proRatingText(pro)].filter(Boolean);
            return (
              <li key={pro._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link to={`/pros/${pro._id}`} className="block font-medium text-gray-900 [overflow-wrap:anywhere] hover:underline">{pro.displayName}</Link>
                  {details.length > 0 && <span className="block text-gray-500">{details.join(' · ')}</span>}
                </span>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAssign(pro._id)}>
                  Asignar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {state !== 'loading' && scope && (
        <button type="button" onClick={() => load(undefined)} className="text-sm font-medium text-gray-600 underline-offset-2 hover:underline">
          Buscar en todas las ciudades
        </button>
      )}
    </div>
  );
}

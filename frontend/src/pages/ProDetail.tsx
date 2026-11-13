import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPro } from '../services/pro';
import Card from '../components/ui/Card';
import { formatEuros, getServiceLabel } from '../utils/tickets';
import { proRatingText } from '../utils/pros';
import ProReviews from '../components/pro/ProReviews';

const ProDetail: React.FC = () => {
  const { id } = useParams();
  const { data: pro, isLoading, isError } = useQuery({ queryKey: ['pros', id], queryFn: () => getPro(id!), enabled: !!id });

  if (isLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (isError || !pro) return <p className="text-sm text-red-700">No encontramos este profesional.</p>;

  const rating = proRatingText(pro);
  return (
    <div className="max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 [overflow-wrap:anywhere]">{pro.displayName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {pro.city}
          {rating && <> · {rating}</>}
        </p>
      </div>
      <Card className="overflow-hidden">
        <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">Servicios</h2>
        {(pro.services || []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">Sin servicios publicados.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(pro.services || []).map((s: any) => (
              <li key={s.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-gray-900">{getServiceLabel(s.key)}</span>
                {s.basePrice != null && <span className="tabular-nums text-gray-500">desde {formatEuros(Number(s.basePrice))}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ProReviews proProfileId={String(pro._id)} ratingAvg={pro.ratingAvg} reviewCount={pro.reviewCount} />
    </div>
  );
};

export default ProDetail;

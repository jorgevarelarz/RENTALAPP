import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProSummary } from '../../services/tickets';
import PageHeader from '../../components/ui/PageHeader';
import ProTicketList from '../../components/pro/ProTicketList';
import { formatEuros } from '../../utils/tickets';
import { PRO_BILLABLE_STATUSES } from '../../utils/proTickets';

export default function ProQuotes() {
  const { data: summary } = useQuery({ queryKey: ['pro/summary'], queryFn: getProSummary });
  const s = summary?.quotes;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Presupuestos"
        subtitle="Las incidencias que te han asignado: envía el presupuesto y sigue si el propietario lo aprueba."
        cta={s && (
          <p className="text-sm text-gray-500">
            Presupuestado en total <span className="font-semibold tabular-nums text-gray-900">{formatEuros(s.quotedTotal)}</span>
          </p>
        )}
      />

      <ProTicketList
        queryKey="pro/quotes"
        filters={[
          { value: 'open', label: 'Por presupuestar', count: s?.toQuote },
          { value: 'quoted', label: 'Esperando al propietario', count: s?.awaitingApproval },
          { value: PRO_BILLABLE_STATUSES, label: 'Aprobados', count: s?.approved },
          { value: '', label: 'Todos' },
        ]}
        emptyText="No hay incidencias en este estado. Cuando un propietario te asigne una avería, aparecerá en «Por presupuestar»."
        renderAmount={ticket =>
          ticket.quote ? (
            <span className="font-semibold tabular-nums text-gray-900">{formatEuros(Number(ticket.quote.amount) || 0)}</span>
          ) : (
            <span className="text-sm font-medium text-[var(--primary)]">Enviar presupuesto</span>
          )
        }
      />
    </div>
  );
}

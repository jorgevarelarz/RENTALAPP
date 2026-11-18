import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { downloadProBillingCsv, getProSummary } from '../../services/tickets';
import PageHeader from '../../components/ui/PageHeader';
import ProTicketList, { SummaryFigures } from '../../components/pro/ProTicketList';
import { useToast } from '../../context/ToastContext';
import { formatEuros } from '../../utils/tickets';
import { PRO_BILLABLE_STATUSES, PRO_PENDING_STATUSES, billableAmounts } from '../../utils/proTickets';

const secondaryButton =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-50';

const jobs = (n: number) => (n === 1 ? '1 trabajo' : `${n} trabajos`);

export default function ProBilling() {
  const { push } = useToast();
  const [exporting, setExporting] = useState(false);
  const { data: summary } = useQuery({ queryKey: ['pro/summary'], queryFn: getProSummary });
  const b = summary?.billing;
  const billableCount = b ? b.pendingCount + b.releasedCount : undefined;

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadProBillingCsv();
    } catch {
      push({ title: 'No se pudo descargar el CSV. Vuelve a intentarlo en un momento.', tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Facturación"
        subtitle="Trabajos con el presupuesto aprobado. Cada importe es el presupuesto más los extras que aprobó el propietario."
        cta={
          <button type="button" onClick={exportCsv} disabled={exporting || !billableCount} className={secondaryButton}>
            <Download className="h-4 w-4" aria-hidden="true" /> {exporting ? 'Descargando…' : 'Exportar CSV'}
          </button>
        }
      />

      <SummaryFigures
        figures={[
          { label: 'Pendiente de liberar', value: b ? formatEuros(b.pendingTotal) : '—', hint: b ? jobs(b.pendingCount) : undefined },
          { label: 'Pagos liberados', value: b ? formatEuros(b.releasedTotal) : '—', hint: b ? jobs(b.releasedCount) : undefined },
        ]}
      />

      <ProTicketList
        queryKey="pro/billing"
        filters={[
          { value: PRO_BILLABLE_STATUSES, label: 'Todos', count: billableCount },
          { value: PRO_PENDING_STATUSES, label: 'Pendientes de liberar', count: b?.pendingCount },
          { value: 'closed', label: 'Liberados', count: b?.releasedCount },
        ]}
        emptyText="Aún no tienes trabajos facturables. Aparecen aquí cuando el propietario aprueba tu presupuesto."
        renderAmount={ticket => {
          const { quote, extra, total } = billableAmounts(ticket);
          return (
            <>
              <p className="font-semibold tabular-nums text-gray-900">{formatEuros(total)}</p>
              {extra > 0 && (
                <p className="text-xs tabular-nums text-gray-500">{formatEuros(quote)} + {formatEuros(extra)} extra</p>
              )}
            </>
          );
        }}
      />
    </div>
  );
}

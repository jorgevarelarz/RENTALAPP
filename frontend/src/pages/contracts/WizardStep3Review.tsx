import React from 'react';
import { createContract } from '../../services/contracts';
import { useNotify } from '../../utils/notify';
import { sendEmail } from '../../services/notify';

type Props = { basics: any; clauses: Record<string, any>; onBack: () => void; onCreated: (c: any) => void };
export default function WizardStep3Review({ basics, clauses, onBack, onCreated }: Props) {
  const { push } = useNotify();
  const handleCreate = async () => {
    try {
      const payload = {
        landlord: basics.landlord,
        tenant: basics.tenant,
        property: basics.property,
        region: basics.region,
        rent: basics.rent,
        deposit: basics.deposit,
        startDate: basics.startDate,
        endDate: basics.endDate,
        clauses: Object.entries(clauses).map(([id, params]) => ({ id, params })),
      };
      const contract = await createContract(payload);
      onCreated(contract);
      push('success', 'Contrato creado correctamente');
      try {
        await sendEmail(
          'notificaciones@rental-app.test',
          'Nuevo contrato creado',
          `Se ha generado el contrato ${contract._id || contract.id || 'sin ID'}.`
        );
      } catch (error) {
        console.warn('No se pudo disparar email de contrato', error);
      }
    } catch (error: any) {
      const raw = error?.response?.data?.error;
      const msg = raw && String(raw).toLowerCase().includes('contrato activo vigente')
        ? 'No puedes alquilar esta propiedad porque ya hay un contrato vigente.'
        : raw || 'No se pudo crear el contrato';
      push('error', msg);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      <h2>Revisión</h2>
      <pre style={{ background: '#fafafa', padding: 12, borderRadius: 6 }}>
        {JSON.stringify({ ...basics, clauses }, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onBack}>Atrás</button>
        <button onClick={handleCreate}>Crear contrato</button>
      </div>
    </div>
  );
}

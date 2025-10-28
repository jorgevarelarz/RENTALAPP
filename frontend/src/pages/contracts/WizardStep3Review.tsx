import React from 'react';
import { createContract } from '../../api/contracts';
import { useNotify } from '../../utils/notify';
import { sendEmail } from '../../api/notify';
import { useAuth } from '../../context/AuthContext';

type Props = { basics: any; clauses: Record<string, any>; onBack: () => void; onCreated: (c: any) => void };
export default function WizardStep3Review({ basics, clauses, onBack, onCreated }: Props) {
  const { push } = useNotify();
  const { user } = useAuth();
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
        landlordType: basics.landlordType ?? 'individual',
        clauses,
      };
      const contract = await createContract(payload);
      onCreated(contract);
      push('success', 'Contrato creado correctamente');
      if (user?.role === 'admin') {
        try {
          await sendEmail(
            'notificaciones@rental-app.test',
            'Nuevo contrato creado',
            `Se ha generado el contrato ${contract._id || contract.id || 'sin ID'}.`
          );
        } catch (error) {
          console.warn('No se pudo disparar email de contrato', error);
        }
      }
    } catch (error: any) {
      push('error', error?.response?.data?.error || 'No se pudo crear el contrato');
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

import React from 'react';
import { createContract } from '../../services/contracts';

type Props = { basics: any; clauses: Record<string, any>; onBack: () => void; onCreated: (c: any) => void };
export default function WizardStep3Review({ basics, clauses, onBack, onCreated }: Props) {
  const handleCreate = async () => {
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

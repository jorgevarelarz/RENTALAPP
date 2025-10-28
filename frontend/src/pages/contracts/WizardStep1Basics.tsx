import React from 'react';

type Props = { value: any; onChange: (v: any) => void; onNext: () => void };
export default function WizardStep1Basics({ value, onChange, onNext }: Props) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <h2>Datos del contrato</h2>
      <input placeholder="ID Arrendador" value={value.landlord || ''} onChange={(e) => set('landlord', e.target.value)} />
      <label style={{ display: 'grid', gap: 4 }}>
        Tipo de arrendador
        <select value={value.landlordType || 'individual'} onChange={(e) => set('landlordType', e.target.value)}>
          <option value="individual">Persona física</option>
          <option value="company">Persona jurídica</option>
        </select>
      </label>
      <input placeholder="ID Inquilino" value={value.tenant || ''} onChange={(e) => set('tenant', e.target.value)} />
      <input placeholder="ID Propiedad" value={value.property || ''} onChange={(e) => set('property', e.target.value)} />
      <select value={value.region || ''} onChange={(e) => set('region', e.target.value)}>
        <option value="">Selecciona CCAA</option>
        <option value="galicia">Galicia</option>
        <option value="catalunya">Cataluña</option>
        <option value="madrid">Madrid</option>
      </select>
      <input type="number" placeholder="Renta €/mes" value={value.rent || ''} onChange={(e) => set('rent', Number(e.target.value))} />
      <input type="number" placeholder="Fianza €" value={value.deposit || ''} onChange={(e) => set('deposit', Number(e.target.value))} />
      <label>
        Inicio <input type="date" value={value.startDate || ''} onChange={(e) => set('startDate', e.target.value)} />
      </label>
      <label>
        Fin <input type="date" value={value.endDate || ''} onChange={(e) => set('endDate', e.target.value)} />
      </label>
      <button
        disabled={
          !value.landlord ||
          !value.tenant ||
          !value.property ||
          !value.region ||
          !value.rent ||
          !value.deposit ||
          !value.startDate ||
          !value.endDate
        }
        onClick={onNext}
      >
        Siguiente
      </button>
    </div>
  );
}

import React, { useState } from 'react';
import { createProperty } from '../api/properties';

const Dashboard: React.FC = () => {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [onlyTenantPro, setOnlyTenantPro] = useState(false);
  const [requiredTenantProMaxRent, setRequiredTenantProMaxRent] = useState('');
  const token = localStorage.getItem('token') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProperty(token, {
      title,
      address,
      price: Number(price),
      onlyTenantPro,
      requiredTenantProMaxRent: Number(requiredTenantProMaxRent || 0),
    });
    setTitle('');
    setAddress('');
    setPrice('');
    setOnlyTenantPro(false);
    setRequiredTenantProMaxRent('');
    alert('Propiedad creada');
  };

  return (
    <div>
      <h1>Crear inmueble</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} required />
        <input placeholder="Dirección" value={address} onChange={e => setAddress(e.target.value)} required />
        <input type="number" placeholder="Renta" value={price} onChange={e => setPrice(e.target.value)} required />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={onlyTenantPro} onChange={e => setOnlyTenantPro(e.target.checked)} />
          Solo inquilinos PRO
        </label>
        {onlyTenantPro && (
          <input
            type="number"
            placeholder="Validación mínima (EUR/mes, 0 = precio)"
            value={requiredTenantProMaxRent}
            onChange={e => setRequiredTenantProMaxRent(e.target.value)}
          />
        )}
        <button type="submit">Guardar</button>
      </form>
    </div>
  );
};

export default Dashboard;

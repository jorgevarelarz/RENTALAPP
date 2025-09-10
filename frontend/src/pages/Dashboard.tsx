import React, { useState } from 'react';
import { createProperty } from '../services/properties';

const Dashboard: React.FC = () => {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const token = localStorage.getItem('token') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProperty(token, { title, address, price: Number(price) });
    setTitle('');
    setAddress('');
    setPrice('');
    alert('Propiedad creada');
  };

  return (
    <div>
      <h1>Crear inmueble</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} required />
        <input placeholder="Dirección" value={address} onChange={e => setAddress(e.target.value)} required />
        <input type="number" placeholder="Renta" value={price} onChange={e => setPrice(e.target.value)} required />
        <button type="submit">Guardar</button>
      </form>
    </div>
  );
};

export default Dashboard;

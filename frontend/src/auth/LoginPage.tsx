import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { signInSuccess, UserRole } from '../app/store/authSlice';

const roleOptions: UserRole[] = ['TENANT', 'LANDLORD', 'PROFESSIONAL', 'AGENCY', 'ADMIN'];

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<UserRole>('TENANT');
  const from = (location.state as any)?.from ?? '/';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch(signInSuccess({
      token: 'demo-token',
      user: {
        id: 'user-1',
        name: 'Demo User',
        email: 'demo@rentalapp.test',
        roles: role === 'ADMIN' ? roleOptions : [role],
        activeRole: role,
      },
    }));
    navigate(from, { replace: true });
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <h1 style={{ marginBottom: 16 }}>RentalApp</h1>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Selecciona un rol para esta sesión</span>
          <select value={role} onChange={event => setRole(event.target.value as UserRole)} style={inputStyle}>
            {roleOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button type="submit" style={buttonStyle}>
          Entrar
        </button>
      </form>
    </div>
  );
};

const formStyle: React.CSSProperties = {
  background: '#fff',
  padding: '32px 40px',
  borderRadius: 20,
  border: '1px solid #e2e8f0',
  display: 'grid',
  gap: 16,
  width: 320,
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  borderRadius: 12,
  padding: '10px 12px',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

export default LoginPage;

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TenantKyc from '../Kyc';

const { auth } = vi.hoisted(() => ({ auth: { isVerified: false as boolean | undefined } }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 't1', email: 'ana@example.com', role: 'tenant', isVerified: auth.isVerified } }),
}));

function renderKyc() {
  return render(
    <MemoryRouter>
      <TenantKyc />
    </MemoryRouter>,
  );
}

describe('Verificación de identidad del inquilino', () => {
  it('sin verificar dice qué no puede hacer y qué sí, sin pedir documentos', () => {
    auth.isVerified = false;
    renderKyc();
    expect(screen.getByText('Sin verificar')).toBeInTheDocument();
    expect(screen.getByText('firmar contratos ni pagar la renta o la fianza.')).toBeInTheDocument();
    expect(screen.getByText(/no tienes que subir nada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Completar perfil' })).toHaveAttribute('href', '/profile');
  });

  it('verificada lo confirma', () => {
    auth.isVerified = true;
    renderKyc();
    expect(screen.getByText('Verificada')).toBeInTheDocument();
    expect(screen.queryByText('Sin verificar')).toBeNull();
  });
});

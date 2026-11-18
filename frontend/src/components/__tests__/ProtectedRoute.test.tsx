import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../ProtectedRoute';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

function LoginSpy() {
  const loc = useLocation();
  return <p>from: {(loc.state as any)?.from}</p>;
}

describe('ProtectedRoute', () => {
  it('sin sesión manda al login recordando la ruta entera, con consulta y ancla', () => {
    render(
      <MemoryRouter initialEntries={['/contracts/c1?deposit=success#pagos']}>
        <Routes>
          <Route path="/contracts/:id" element={<ProtectedRoute><p>Contrato</p></ProtectedRoute>} />
          <Route path="/login" element={<LoginSpy />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('from: /contracts/c1?deposit=success#pagos')).toBeInTheDocument();
  });
});

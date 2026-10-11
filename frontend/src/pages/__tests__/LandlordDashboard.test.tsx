import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { _id: 'u1', role: 'landlord' } }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), remove: vi.fn(), toasts: [] }),
}));

vi.mock('../../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../services/properties', () => ({
  listProperties: vi.fn().mockResolvedValue([
    { _id: 'p1', owner: 'u1', title: 'Piso Centro', address: 'Calle Mayor 1', city: 'Santiago', price: 950, status: 'active', images: ['a', 'b', 'c'] },
    { _id: 'p2', owner: 'u1', title: 'Estudio', address: 'Rúa Nova 3', city: 'Santiago', price: 620, status: 'draft', images: [] },
  ]),
  createProperty: vi.fn(),
}));

vi.mock('../../services/contracts', () => ({
  listContracts: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../../services/user', () => ({
  userService: {
    getLandlordStats: vi.fn().mockResolvedValue({
      earnings: 12345.5,
      properties: { total: 2, rented: 0 },
      contracts: { pending: 1 },
      recentPayments: [
        { id: 'pay1', amount: 950, concept: 'Renta octubre', propertyName: 'Piso Centro', date: '2026-10-01T10:00:00.000Z' },
        { id: 'pay2', amount: 40, concept: 'Recibo agua', propertyName: 'Piso Centro', date: null },
      ],
    }),
  },
}));

vi.mock('../../components/OnboardingChecklist', () => ({ default: () => null }));
vi.mock('../../components/PropertyFormRHF', () => ({ default: () => null }));
vi.mock('../../components/ApplicantsModal', () => ({ default: () => null }));

import LandlordDashboard from '../LandlordDashboard';

describe('LandlordDashboard', () => {
  test('muestra importes en euros, fechas válidas y plurales correctos', async () => {
    render(
      <MemoryRouter>
        <LandlordDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Últimos pagos recibidos')).toBeInTheDocument();
    // Importes con formato es-ES
    expect(screen.getByText(/12\.345,50\s€/)).toBeInTheDocument();
    expect(screen.getByText(/^950,00\s€$/)).toBeInTheDocument();
    expect(await screen.findByText(/950,00\s€\/mes/)).toBeInTheDocument();
    // Un pago sin fecha no muestra «Invalid Date»
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(screen.getByText('Piso Centro · 1 oct 2026')).toBeInTheDocument();
    // Resumen de propiedades y alertas en singular
    expect(screen.getByText(/1 publicada · 1 borrador · 0 alquiladas/)).toBeInTheDocument();
    expect(screen.getByText('1 borrador pendiente')).toBeInTheDocument();
    expect(screen.getByText('1 propiedad con pocas fotos')).toBeInTheDocument();
    // La fila de contadores duplicada ya no existe
    expect(screen.queryByText('Total Inmuebles')).not.toBeInTheDocument();
    // Gestión rápida no lleva al buscador público
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['/contracts', '/landlord/payments', '/landlord/showings', '/landlord/issues']));
    expect(links).not.toContain('/properties');
  });
});

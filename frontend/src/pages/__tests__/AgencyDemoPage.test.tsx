import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgencyDemoPage from '../AgencyDemoPage';

describe('AgencyDemoPage', () => {
  it('presents the implemented agency flow without implying public self-registration', () => {
    render(
      <MemoryRouter>
        <AgencyDemoPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /abre la puerta.*entrega el control/i })).toBeInTheDocument();
    expect(screen.getByText(/sobre la comisión de plataforma, no sobre la renta completa/i)).toBeInTheDocument();
    expect(screen.getByText(/autofactura en PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/se habilitan desde la administración de RentalApp/i)).toBeInTheDocument();

    const accessLinks = screen.getAllByRole('link', { name: /acceder/i });
    expect(accessLinks.length).toBeGreaterThan(0);
    expect(accessLinks.every((link) => link.getAttribute('href') === '/login')).toBe(true);
  });
});

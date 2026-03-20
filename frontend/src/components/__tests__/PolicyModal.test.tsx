import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedFunction, vi } from 'vitest';
import PolicyModal from '../PolicyModal';
import { usePolicyAcceptance } from '../../hooks/usePolicyAcceptance';

vi.mock('../../hooks/usePolicyAcceptance');
const mockUsePolicyAcceptance = usePolicyAcceptance as MockedFunction<
  typeof usePolicyAcceptance
>;

describe('PolicyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePolicyAcceptance.mockReturnValue({
      loading: false,
      needsAcceptance: false,
      hasAccepted: false,
      acceptPolicy: vi.fn(),
    });
  });

  it('does not render when isOpen is false', () => {
    render(<PolicyModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Política de Privacidad/i)).toBeNull();
  });

  it('renders content when open and handles cancel', () => {
    const onClose = vi.fn();
    render(<PolicyModal isOpen={true} onClose={onClose} pendingType="data_processing" />);

    expect(screen.getByRole('heading', { name: /Política de Datos/i })).toBeInTheDocument();
    expect(screen.getByText(/Leer Política de Datos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Cancelar/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls acceptPolicy and onClose when accepting', () => {
    const onClose = vi.fn();
    const acceptPolicy = vi.fn();
    mockUsePolicyAcceptance.mockReturnValueOnce({
      loading: false,
      needsAcceptance: true,
      hasAccepted: false,
      acceptPolicy,
    });

    render(<PolicyModal isOpen={true} onClose={onClose} pendingType="privacy_policy" />);

    const buttons = screen.getAllByText(/Política de Privacidad/i);
    const cta = buttons.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(cta);
    expect(acceptPolicy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

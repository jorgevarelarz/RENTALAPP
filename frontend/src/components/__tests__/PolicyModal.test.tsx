import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PolicyModal from '../PolicyModal';
import { usePolicyAcceptance } from '../../hooks/usePolicyAcceptance';

jest.mock('../../hooks/usePolicyAcceptance');
const mockUsePolicyAcceptance = usePolicyAcceptance as jest.MockedFunction<
  typeof usePolicyAcceptance
>;

describe('PolicyModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePolicyAcceptance.mockReturnValue({
      loading: false,
      needsAcceptance: false,
      hasAccepted: false,
      acceptPolicy: jest.fn(),
    });
  });

  it('does not render when isOpen is false', () => {
    render(<PolicyModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText(/Política de Privacidad/i)).toBeNull();
  });

  it('renders content when open and handles cancel', () => {
    const onClose = jest.fn();
    render(<PolicyModal isOpen={true} onClose={onClose} />);

    expect(screen.getByRole('heading', { name: /Política de Privacidad/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Cancelar/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls acceptPolicy and onClose when accepting', () => {
    const onClose = jest.fn();
    const acceptPolicy = jest.fn();
    mockUsePolicyAcceptance.mockReturnValueOnce({
      loading: false,
      needsAcceptance: true,
      hasAccepted: false,
      acceptPolicy,
    });

    render(<PolicyModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText(/Aceptar y Continuar/i));
    expect(acceptPolicy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

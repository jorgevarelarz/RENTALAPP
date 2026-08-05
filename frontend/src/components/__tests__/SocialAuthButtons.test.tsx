import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../api/client', () => ({
  api: { get },
}));

import SocialAuthButtons from '../SocialAuthButtons';

describe('SocialAuthButtons', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('shows only configured providers and preserves the selected role', async () => {
    get.mockResolvedValue({
      data: { providers: { google: true, apple: false } },
    });

    render(<SocialAuthButtons mode="register" role="landlord" redirect="/landlord" />);

    const google = await screen.findByRole('link', { name: 'Continuar con Google' });
    expect(google).toHaveAttribute(
      'href',
      '/api/auth/oauth/google/start?mode=register&role=landlord&redirect=%2Flandlord',
    );
    expect(screen.queryByRole('link', { name: 'Continuar con Apple' })).not.toBeInTheDocument();
  });

  it('stays hidden when no provider is configured', async () => {
    get.mockResolvedValue({
      data: { providers: { google: false, apple: false } },
    });

    render(<SocialAuthButtons mode="login" />);

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Continuar con/)).not.toBeInTheDocument();
  });
});

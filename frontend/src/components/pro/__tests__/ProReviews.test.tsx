import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Mock, vi } from 'vitest';
import ProReviews from '../ProReviews';
import * as reviewService from '../../../services/reviews';

vi.mock('../../../services/reviews');

const renderList = (props: Partial<React.ComponentProps<typeof ProReviews>> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProReviews proProfileId="p1" ratingAvg={4.5} reviewCount={6} {...props} />
    </QueryClientProvider>,
  );

const review = (n: number) => ({ id: `r${n}`, score: 4, createdAt: '2026-10-01T10:00:00.000Z', author: `Autor ${n}`, comment: n === 1 ? 'Puntual' : undefined });

describe('ProReviews', () => {
  beforeEach(() => vi.clearAllMocks());

  test('enseña media, autor, mes y comentario, y carga más', async () => {
    (reviewService.getProReviews as Mock)
      .mockResolvedValueOnce({ items: [1, 2, 3, 4, 5].map(review), total: 6, page: 1, limit: 5 })
      .mockResolvedValueOnce({ items: [review(6)], total: 6, page: 2, limit: 5 });
    renderList();

    expect(await screen.findByText('Autor 1')).toBeInTheDocument();
    expect(screen.getByText('4,5 · 6 opiniones')).toBeInTheDocument();
    expect(screen.getByText('Puntual')).toBeInTheDocument();
    expect(screen.getAllByText('octubre de 2026')).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: 'Ver más opiniones' }));
    expect(await screen.findByText('Autor 6')).toBeInTheDocument();
    expect(reviewService.getProReviews).toHaveBeenLastCalledWith('p1', 2, 5);
    expect(screen.queryByRole('button', { name: 'Ver más opiniones' })).not.toBeInTheDocument();
  });

  test('sin opiniones no enseña una media de 0', async () => {
    (reviewService.getProReviews as Mock).mockResolvedValue({ items: [], total: 0, page: 1, limit: 5 });
    renderList({ ratingAvg: 0, reviewCount: 0 });
    expect(await screen.findByText(/Aún no tiene opiniones/)).toBeInTheDocument();
    expect(screen.queryByText(/0,0/)).not.toBeInTheDocument();
  });
});

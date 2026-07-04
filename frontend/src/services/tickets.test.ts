import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decideExtra } from './tickets';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('../api/client', () => ({
  api: { post: postMock },
}));

describe('tickets service', () => {
  beforeEach(() => {
    postMock.mockResolvedValue({ data: { ok: true } });
  });

  it('sends the backend approve boolean when deciding extras', async () => {
    await decideExtra('ticket-1', 'approved');
    expect(postMock).toHaveBeenCalledWith('/api/tickets/ticket-1/extra/decide', { approve: true });

    await decideExtra('ticket-1', 'rejected');
    expect(postMock).toHaveBeenCalledWith('/api/tickets/ticket-1/extra/decide', { approve: false });
  });
});

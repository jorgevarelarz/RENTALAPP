import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api/client', () => ({ api: { get } }));

import { listMyProperties } from '../properties';

const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ _id: `p${from + i}` }));

describe('listMyProperties', () => {
  beforeEach(() => get.mockReset());

  it('recorre las páginas de /api/properties/mine hasta tenerlos todos', async () => {
    get
      .mockResolvedValueOnce({ data: { items: page(0, 100), total: 130 } })
      .mockResolvedValueOnce({ data: { items: page(100, 30), total: 130 } });
    const items = await listMyProperties({ status: 'draft' });
    expect(items).toHaveLength(130);
    expect(get).toHaveBeenNthCalledWith(1, '/api/properties/mine', { params: { status: 'draft', page: 1, limit: 100 } });
    expect(get).toHaveBeenNthCalledWith(2, '/api/properties/mine', { params: { status: 'draft', page: 2, limit: 100 } });
  });

  it('con una sola página no pide más', async () => {
    get.mockResolvedValueOnce({ data: { items: page(0, 3), total: 3 } });
    expect(await listMyProperties()).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

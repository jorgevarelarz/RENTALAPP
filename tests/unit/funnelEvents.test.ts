import { recordFunnelEvent } from '../../src/services/funnelEvents.service';
import { SystemEvent } from '../../src/models/systemEvent.model';
import { emitSystemEvent } from '../../src/events/system.events';

jest.mock('../../src/models/systemEvent.model', () => ({
  SystemEvent: { create: jest.fn() },
}));

jest.mock('../../src/events/system.events', () => ({
  emitSystemEvent: jest.fn(),
}));

describe('funnelEvents service', () => {
  afterEach(() => jest.clearAllMocks());

  it('stores minimal funnel metadata without requiring an authenticated user', async () => {
    const req: any = {
      method: 'GET',
      originalUrl: '/api/properties?city=Madrid',
      ip: '127.0.0.1',
      headers: {},
      res: { locals: { requestId: 'req_123' } },
    };

    await recordFunnelEvent(req, 'search', { meta: { city: 'Madrid', total: 3 } });

    const event: any = (SystemEvent.create as jest.Mock).mock.calls[0][0];
    expect(event.resourceType).toBe('funnel');
    expect(event.resourceId).toBeTruthy();
    expect(event.payload.requestId).toBe('req_123');
    expect(event.payload.funnelType).toBe('search');
    expect(event.payload.city).toBe('Madrid');
    expect(event.payload.total).toBe(3);
    expect(emitSystemEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'FUNNEL_SEARCH' }));
  });
});

import { canTransition, transitionContract } from '../../src/services/contractState';
import { getNextSigningStatus, normalizeContractStatus } from '../../src/domain/contracts/status';
import { Contract } from '../../src/models/contract.model';

it('supports legacy signing states without reopening closed or unknown contracts', async () => {
  expect(canTransition('generated', 'pending_signature')).toBe(true);
  expect(canTransition('signing', 'signed')).toBe(true);
  expect(canTransition('signed', 'active')).toBe(true);
  for (const state of ['completed', 'cancelled', 'terminated', 'unknown']) {
    expect(canTransition(state, 'pending_signature')).toBe(false);
    expect(canTransition(state, 'signed')).toBe(false);
  }
  expect(normalizeContractStatus('cancelled')).toBe('terminated');
  expect(getNextSigningStatus({ signedByTenant: true })).toBe('pending_signature');
  expect(getNextSigningStatus({ signedByLandlord: true })).toBe('pending_signature');
  expect(getNextSigningStatus({ signedByTenant: true, signedByLandlord: true })).toBe('signed');

  const contract = { status: 'signing', save: jest.fn().mockResolvedValue(undefined) };
  const query: any = { populate: jest.fn() };
  query.populate.mockReturnValueOnce(query).mockResolvedValueOnce(contract);
  const find = jest.spyOn(Contract, 'findById').mockReturnValue(query);
  try {
    await transitionContract('legacy', 'signed');
    expect(contract.status).toBe('signed');
    expect(contract.save).toHaveBeenCalledTimes(1);
  } finally {
    find.mockRestore();
  }
});

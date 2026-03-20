import { vi, type Mock } from 'vitest';

type AxiosMock = {
  get: Mock;
  post: Mock;
  create: Mock;
};

const mockAxios: AxiosMock = {
  get: vi.fn(),
  post: vi.fn(),
  create: vi.fn(() => mockAxios),
};

export default mockAxios;
export { mockAxios };

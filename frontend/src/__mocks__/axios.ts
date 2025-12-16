const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn(() => mockAxios),
};

export default mockAxios;
export { mockAxios };

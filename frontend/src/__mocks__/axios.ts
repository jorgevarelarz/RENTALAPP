type AxiosMock = {
  get: jest.Mock;
  post: jest.Mock;
  create: jest.Mock<AxiosMock, []>;
};

const mockAxios: AxiosMock = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn(() => mockAxios),
};

export default mockAxios;
export { mockAxios };

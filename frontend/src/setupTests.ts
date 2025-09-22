// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock mínimo para @hookform/resolvers/zod para evitar dependencia de zod/v4 (ESM) en Jest de CRA
jest.mock('@hookform/resolvers/zod', () => {
  return {
    zodResolver: () => async (values: any) => ({ values, errors: {} }),
  };
});

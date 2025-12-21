import React from 'react';

export const useParams = () => ({ id: 'ticket123' });
export const useNavigate = () => () => {};

export const MemoryRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
export const Routes: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const Route: React.FC<{ element: React.ReactElement }> = ({ element }) => element;
export const Link: React.FC<{ to: string; children: React.ReactNode }> = ({ children, to }) => (
  <a href={to}>{children}</a>
);

export default {
  useParams,
  useNavigate,
  MemoryRouter,
  Routes,
  Route,
  Link,
};

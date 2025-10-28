import React from 'react';
import AppProviders from './app/providers/AppProviders';
import AppRoutes from './AppRoutes';

const App: React.FC = () => (
  <AppProviders>
    <AppRoutes />
  </AppProviders>
);

export default App;

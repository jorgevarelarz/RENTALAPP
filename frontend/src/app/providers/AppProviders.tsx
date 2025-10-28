import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store';
import { I18nProvider } from '../i18n/I18nProvider';
import FeatureFlagsProvider from '../../api/FeatureFlagsProvider';

const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>
    <I18nProvider>
      <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
    </I18nProvider>
  </Provider>
);

export default AppProviders;

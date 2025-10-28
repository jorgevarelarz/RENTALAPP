import React from 'react';
import { Outlet } from 'react-router-dom';
import RoleSidebar from '../components/layout/RoleSidebar';
import Topbar from '../components/layout/Topbar';
import { roleNavigation } from './navigation';
import { useAppSelector } from '../app/hooks';
import { useI18n } from '../app/i18n/I18nProvider';

const RoleLayout: React.FC = () => {
  const { user } = useAppSelector(state => state.auth);
  const { t } = useI18n();

  if (!user) {
    return null;
  }

  const items = roleNavigation[user.activeRole];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      <Topbar />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        <RoleSidebar items={items} />
        <main
          style={{
            flex: 1,
            padding: '24px 32px',
            background: '#fff',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default RoleLayout;

export const NoAccess: React.FC = () => {
  const { t } = useI18n();
  return (
    <div style={{ padding: 32, display: 'grid', gap: 12 }}>
      <h2>{t('layout.no-access.title')}</h2>
      <p>{t('layout.no-access.description')}</p>
    </div>
  );
};

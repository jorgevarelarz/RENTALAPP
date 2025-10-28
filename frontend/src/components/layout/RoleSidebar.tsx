import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../../layouts/navigation';
import { useI18n } from '../../app/i18n/I18nProvider';

interface RoleSidebarProps {
  items: NavItem[];
}

const RoleSidebar: React.FC<RoleSidebarProps> = ({ items }) => {
  const { t } = useI18n();

  return (
    <aside
      style={{
        width: 240,
        borderRight: '1px solid #e2e8f0',
        background: '#f8fafc',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 14,
            textDecoration: 'none',
            color: isActive ? '#0f172a' : '#475569',
            background: isActive ? '#e2e8f0' : 'transparent',
          })}
        >
          <item.icon size={18} aria-hidden />
          <span>{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </aside>
  );
};

export default RoleSidebar;

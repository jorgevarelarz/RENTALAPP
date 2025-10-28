import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import nav from '../../config/nav.config.json';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <aside style={{ width: 220, borderRight: '1px solid #eee', padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Panel</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!role && <NavLink to="/" style={{ textDecoration: 'none' }}>Explorar</NavLink>}
        {role && ((nav as any)[role] || []).map((item: any) => (
          <NavLink key={item.path} to={item.path}>{item.label}</NavLink>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import nav from '../config/nav.config.json';

type NavItem = { path: string; label: string };

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role || 'tenant';
  const roleNav: NavItem[] = Array.isArray((nav as Record<string, NavItem[]>)[role])
    ? (nav as Record<string, NavItem[]>)[role]
    : [];
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`;

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__title">Panel</div>
      <nav className="app-sidebar__nav" aria-label="Navegación secundaria">
        <NavLink to="/" end className={linkClass}>
          Explorar
        </NavLink>
        {roleNav.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

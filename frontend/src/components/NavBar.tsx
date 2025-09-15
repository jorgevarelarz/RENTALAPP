import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const logoSrc = `${process.env.PUBLIC_URL || ''}/rental-logo.png`;
  const linkClass = ({ isActive }: any) => `nav-link${isActive ? ' active' : ''}`;
  return (
    <nav className="navbar-inner">
      <Link to="/" className="nav-brand">
        <img
          src={logoSrc}
          alt="Rental"
          onError={(e: any) => { e.currentTarget.src = `${process.env.PUBLIC_URL || ''}/logo512.png`; }}
          className="nav-logo"
        />
        <span>Rental</span>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className={linkClass}>Propiedades</NavLink>
        <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
      </div>
      <div className="nav-spacer" />
      {user && (
        <span className="muted" style={{ marginRight: 12 }}>
          Rol: <b>{user.role}</b>
        </span>
      )}
      <button onClick={toggle} className="btn-icon" aria-label="toggle theme" style={{ marginRight: 8 }}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      {!token ? (
        <NavLink to="/login" className="nav-link">Login</NavLink>
      ) : (
        <button onClick={handleLogout} className="nav-link btn-icon" style={{ padding: '6px 10px' }}>Salir</button>
      )}
    </nav>
  );
};

export default NavBar;

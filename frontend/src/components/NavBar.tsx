import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const linkStyle: React.CSSProperties = { marginRight: 12, padding: '6px 10px', borderRadius: 8, textDecoration: 'none' };
  const active = ({ isActive }: any) => ({ ...linkStyle, background: isActive ? 'var(--border)' : 'transparent' });

  const logoSrc = `${process.env.PUBLIC_URL || ''}/rental-logo.png`;
  return (
    <nav style={{ padding: 12, borderBottom: '1px solid #eee', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginRight: 16, textDecoration: 'none', color: 'inherit' }}>
        <img
          src={logoSrc}
          alt="Rental"
          onError={(e: any) => { e.currentTarget.src = `${process.env.PUBLIC_URL || ''}/logo512.png`; }}
          style={{ width: 28, height: 28, objectFit: 'contain' }}
        />
        <span>Rental</span>
      </Link>
      <NavLink to="/" style={active}>Propiedades</NavLink>
      <NavLink to="/dashboard" style={active}>Dashboard</NavLink>
      {user && (
        <span style={{ marginLeft: 'auto', marginRight: 12, opacity: 0.7 }}>
          Rol: <b>{user.role}</b>
        </span>
      )}
      <button onClick={toggle} style={{ marginRight: 12 }}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      {!token ? (
        <NavLink to="/login" style={linkStyle}>Login</NavLink>
      ) : (
        <button onClick={handleLogout}>Salir</button>
      )}
    </nav>
  );
};

export default NavBar;

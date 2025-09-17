import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './NavBar.module.css';

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const logoSrc = `${process.env.PUBLIC_URL || ''}/rental-logo.png`;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.link}${isActive ? ` ${styles.linkActive}` : ''}`;
  return (
    <nav className={styles.inner}>
      <Link to="/" className={styles.brand}>
        <img
          src={logoSrc}
          alt="Rental"
          onError={(e: any) => { e.currentTarget.src = `${process.env.PUBLIC_URL || ''}/logo512.png`; }}
          className={styles.logo}
        />
        <span>Rental</span>
      </Link>
      <div className={styles.links}>
        <NavLink to="/" className={linkClass}>Propiedades</NavLink>
        <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
      </div>
      <div className={styles.spacer} />
      {user && (
        <span style={{ marginRight: 12, color: 'var(--muted)' }}>
          Rol: <b>{user.role}</b>
        </span>
      )}
      <button onClick={toggle} className={styles.iconButton} aria-label="toggle theme" style={{ marginRight: 8 }}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      {!token ? (
        <NavLink to="/login" className={linkClass}>Login</NavLink>
      ) : (
        <button onClick={handleLogout} className={`${styles.link} ${styles.iconButton}`} style={{ padding: '6px 10px' }}>
          Salir
        </button>
      )}
    </nav>
  );
};

export default NavBar;

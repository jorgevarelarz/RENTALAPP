import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingPage from './LandingPage';

export default function RedirectHome() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user) {
      const path =
        user.role === 'tenant'
          ? '/tenant'
          : user.role === 'landlord'
          ? '/landlord'
          : user.role === 'pro'
          ? '/pro'
          : user.role === 'admin'
          ? '/admin'
          : '/properties';
      nav(path, { replace: true });
    }
  }, [user, nav]);

  if (user) return null;
  return <LandingPage />;
}

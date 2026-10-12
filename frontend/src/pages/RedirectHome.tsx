import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingPage from './LandingPage';
import { roleHome } from '../utils/roleHome';

export default function RedirectHome() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user) {
      nav(roleHome(user.role, '/properties'), { replace: true });
    }
  }, [user, nav]);

  if (user) return null;
  return <LandingPage />;
}

import React, { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register as registerService, login as loginService } from '../services/auth';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../auth/AuthContext';

type RoleOption = 'tenant' | 'landlord' | 'pro';

const Register: React.FC = () => {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleOption>('tenant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerService(name, email, password, role);
      const token = await loginService(email, password);
      login(token, { name, email, role });
      push({ title: 'Cuenta creada correctamente', tone: 'success' });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error || 'No se pudo completar el registro';
      setError(message);
      push({ title: message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Crea tu cuenta</h1>
      <p className="auth-subtitle">Configura tu espacio en minutos y comienza a gestionar alquileres sin complicaciones.</p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-label" htmlFor="name">
          Nombre completo
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
            placeholder="Tu nombre"
            autoComplete="name"
          />
        </label>
        <label className="auth-label" htmlFor="email">
          Correo electrónico
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            placeholder="correo@dominio.com"
            autoComplete="email"
          />
        </label>
        <label className="auth-label" htmlFor="password">
          Contraseña
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </label>
        <label className="auth-label" htmlFor="role">
          Perfil de uso
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleOption)}
            className="auth-input"
          >
            <option value="tenant">Inquilino</option>
            <option value="landlord">Propietario</option>
            <option value="pro">Profesional</option>
          </select>
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <div className="auth-footer">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="auth-link">Inicia sesión</Link>
      </div>
    </>
  );
};

export default Register;

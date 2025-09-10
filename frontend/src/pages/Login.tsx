import React, { useState } from 'react';
import { login, register } from '../services/auth';
import '../style.css';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(name, email, password);
      }
      const token = await login(email, password);
      localStorage.setItem('token', token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="container">
      <div className="form-box login">
        <form onSubmit={handleSubmit}>
          <h1>{isRegister ? 'Registro' : 'Login'}</h1>
          {isRegister && (
            <div className="input-box">
              <input type="text" placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="input-box">
            <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="input-box">
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn">{isRegister ? 'Registrar' : 'Entrar'}</button>
          <p>
            {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
            <button type="button" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Inicia sesión' : 'Regístrate'}
            </button>
          </p>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;

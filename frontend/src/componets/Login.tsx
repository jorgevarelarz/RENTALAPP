import React, { useState } from 'react';
import { login } from '../services/auth';
import '../style.css';

interface LoginProps {
  onLoginSucces: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSucces }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const token = await login(email, password);
      onLoginSucces(token);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error de login');
    }
  };

  return (
    <div className="container">
      <div className="form-box login">
        <form onSubmit={handleSubmit}>
          <h1>Login</h1>
        
          <div className="input-box">
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <i className="bx bxs-user"></i>
          </div>

          <div className="input-box">
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <i className="bx bxs-lock-alt"></i>
          </div>

          <div className="forgot-link">
            <a href="#">¿Olvidaste tu contraseña?</a>
          </div>

          <button type="submit" className="btn">Entrar</button>

          <p>o inicia sesión con</p>
          <div className="social-icons">
            <a href="#"><i className="bx bxl-google"></i></a>
          </div>

          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;

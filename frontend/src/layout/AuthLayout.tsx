import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Brand from '../components/Brand';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-story">
        <div className="auth-story-orbit auth-story-orbit-one" />
        <div className="auth-story-orbit auth-story-orbit-two" />
        <Brand to="/" inverse />
        <div className="auth-story-copy">
          <p className="auth-story-kicker">Todo el alquiler, conectado</p>
          <h2>Una forma más clara de alquilar.</h2>
          <p>Contratos, cobros, documentación e incidencias en un único espacio compartido.</p>
        </div>
        <div className="auth-story-card">
          <span>✓</span>
          <div>
            <small>Contrato de alquiler</small>
            <strong>Firmado por ambas partes</strong>
          </div>
        </div>
      </div>
      <div className="auth-panel">
        <Brand to="/" className="auth-brand" />
        <div className="auth-card">
          <Outlet />
        </div>
        <Link to="/" className="auth-back"><ArrowLeft size={14} /> Volver al inicio</Link>
      </div>
    </div>
  );
}

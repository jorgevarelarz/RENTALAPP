import React from 'react';

const RegisterPage: React.FC = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
    <div style={{ background: '#fff', padding: '32px 40px', borderRadius: 20, border: '1px solid #e2e8f0' }}>
      <h1>Registro demo</h1>
      <p style={{ maxWidth: 320 }}>
        En esta fase inicial el registro se simula. Usa la pantalla de login para crear una sesión con cualquier rol.
      </p>
    </div>
  </div>
);

export default RegisterPage;

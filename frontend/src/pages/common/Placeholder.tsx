import React from 'react';
import Card from '../../components/ui/Card';

const Placeholder: React.FC<{ title: string; subtitle?: string }>= ({ title, subtitle }) => (
  <div>
    <h2>{title}</h2>
    <Card style={{ padding: 16, marginTop: 8 }}>
      <p style={{ opacity: .8 }}>{subtitle || 'Sección en construcción: pronto añadiremos funcionalidad completa.'}</p>
    </Card>
  </div>
);

export default Placeholder;


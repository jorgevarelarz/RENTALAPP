import React from 'react';

interface ContractViewerProps {
  pdfUrl?: string;
}

const ContractViewer: React.FC<ContractViewerProps> = ({ pdfUrl }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, background: '#fff' }}>
    <h3 style={{ margin: '0 0 8px' }}>Contrato</h3>
    {pdfUrl ? (
      <iframe title="Contrato PDF" src={pdfUrl} style={{ width: '100%', height: 360, border: 'none', borderRadius: 12 }} />
    ) : (
      <p style={{ margin: 0, color: '#475569' }}>PDF pendiente de generar.</p>
    )}
  </div>
);

export default ContractViewer;

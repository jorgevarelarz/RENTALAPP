import React from 'react';

interface DisputePanelProps {
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  summary: string;
}

const DisputePanel: React.FC<DisputePanelProps> = ({ status, summary }) => (
  <div style={{ border: '1px solid #fca5a5', borderRadius: 16, padding: 16, background: '#fef2f2', display: 'grid', gap: 8 }}>
    <h3 style={{ margin: 0 }}>Disputa</h3>
    <p style={{ margin: 0 }}>Estado: <strong>{status}</strong></p>
    <p style={{ margin: 0 }}>{summary}</p>
  </div>
);

export default DisputePanel;

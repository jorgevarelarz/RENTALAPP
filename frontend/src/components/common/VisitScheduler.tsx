import React from 'react';

interface VisitSchedulerProps {
  onPropose?: (payload: { date: string; time: string; location: string }) => void;
}

const VisitScheduler: React.FC<VisitSchedulerProps> = ({ onPropose }) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onPropose?.({
      date: String(formData.get('date')),
      time: String(formData.get('time')),
      location: String(formData.get('location')),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <input name="date" type="date" required style={inputStyle} />
        <input name="time" type="time" required style={inputStyle} />
      </div>
      <input name="location" placeholder="Ubicación" required style={inputStyle} />
      <button type="submit" style={buttonStyle}>Proponer visita</button>
    </form>
  );
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  borderRadius: 12,
  padding: '10px 12px',
  flex: 1,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

export default VisitScheduler;

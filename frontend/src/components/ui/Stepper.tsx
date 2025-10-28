import React from 'react';

export interface Step {
  id: string;
  label: string;
  completed?: boolean;
  current?: boolean;
}

interface StepperProps {
  steps: Step[];
}

const Stepper: React.FC<StepperProps> = ({ steps }) => (
  <ol style={{ display: 'flex', gap: 12, padding: 0, margin: 0, listStyle: 'none' }}>
    {steps.map((step, index) => (
      <li key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: step.completed ? '#111827' : step.current ? '#1d4ed8' : '#e2e8f0',
            color: step.completed || step.current ? '#fff' : '#0f172a',
            fontWeight: 600,
          }}
        >
          {index + 1}
        </span>
        <span style={{ fontWeight: step.current ? 600 : 400 }}>{step.label}</span>
      </li>
    ))}
  </ol>
);

export default Stepper;

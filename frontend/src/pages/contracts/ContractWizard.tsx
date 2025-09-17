import React, { useState } from 'react';
import WizardStep1Basics from './WizardStep1Basics';
import WizardStep2Clauses from './WizardStep2Clauses';
import WizardStep3Review from './WizardStep3Review';

export default function ContractWizard() {
  const [step, setStep] = useState(1);
  const [basics, setBasics] = useState<any>({});
  const [clauses, setClauses] = useState<Record<string, any>>({});
  const [created, setCreated] = useState<any>(null);

  if (created) {
    return (
      <div style={{ maxWidth: 760 }}>
        <h2>Contrato creado ✅</h2>
        <p>
          Estado: <b>{created.status}</b>
        </p>
        <p>
          PDF hash: <code>{created.pdfHash}</code>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {step === 1 && <WizardStep1Basics value={basics} onChange={setBasics} onNext={() => setStep(2)} />}
      {step === 2 && (
        <WizardStep2Clauses
          region={basics.region}
          value={clauses}
          onChange={setClauses}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && <WizardStep3Review basics={basics} clauses={clauses} onBack={() => setStep(2)} onCreated={setCreated} />}
    </div>
  );
}

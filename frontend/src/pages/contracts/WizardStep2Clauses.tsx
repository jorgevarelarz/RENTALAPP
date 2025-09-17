import React, { useEffect, useState } from 'react';
import { getClauses } from '../../services/contracts';

type Props = { region: string; value: Record<string, any>; onChange: (v: any) => void; onNext: () => void; onBack: () => void };
export default function WizardStep2Clauses({ region, value = {}, onChange, onNext, onBack }: Props) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (region) getClauses(region).then((d) => setItems(d.items));
  }, [region]);

  const toggle = (id: string) => {
    const next = { ...value };
    if (next[id]) delete next[id];
    else next[id] = {};
    onChange(next);
  };
  const setParam = (id: string, key: string, v: any) => onChange({ ...value, [id]: { ...(value[id] || {}), [key]: v } });

  const Field = ({ cid, name, meta }: any) => {
    if (meta.type === 'number')
      return (
        <input
          type="number"
          min={meta.min ?? undefined}
          max={meta.max ?? undefined}
          defaultValue={meta.default ?? undefined}
          onChange={(e) => setParam(cid, name, Number(e.target.value))}
        />
      );
    if (meta.type === 'boolean')
      return <input type="checkbox" defaultChecked={!!meta.default} onChange={(e) => setParam(cid, name, e.target.checked)} />;
    return <input type="text" defaultValue={meta.default ?? ''} onChange={(e) => setParam(cid, name, e.target.value)} />;
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      <h2>Cláusulas del contrato ({region})</h2>
      {items.map((c) => {
        const checked = !!value[c.id];
        return (
          <div key={c.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
              <strong>{c.label}</strong>
            </label>
            {checked && c.paramsMeta?.type === 'object' && (
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {Object.entries(c.paramsMeta.fields).map(([k, m]: any) => (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <small>{k}</small>
                    <Field cid={c.id} name={k} meta={m} />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onBack}>Atrás</button>
        <button onClick={onNext}>Siguiente</button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { fetchClauses } from "../../api/clauses";

type Props = {
  region: string;
  value: Record<string, any>; // { [clauseId]: params }
  onChange: (next: Record<string, any>) => void;
};

export default function ClausesStep({ region, value = {}, onChange }: Props) {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchClauses(region).then((d) => setItems(d.items));
  }, [region]);

  const toggle = (id: string) => {
    const next = { ...value };
    if (next[id]) delete next[id]; else next[id] = {};
    onChange(next);
  };

  const setParam = (id: string, key: string, v: any) => {
    onChange({ ...value, [id]: { ...(value[id] || {}), [key]: v } });
  };

  const Field = ({ cid, name, meta }: any) => {
    if (meta.type === "number") {
      return (
        <input
          type="number"
          min={meta.min ?? undefined}
          max={meta.max ?? undefined}
          defaultValue={meta.default ?? undefined}
          onChange={(e) => setParam(cid, name, Number(e.target.value))}
        />
      );
    }
    if (meta.type === "boolean") {
      return (
        <input
          type="checkbox"
          defaultChecked={!!meta.default}
          onChange={(e) => setParam(cid, name, e.target.checked)}
        />
      );
    }
    // fallback string
    return (
      <input
        type="text"
        defaultValue={meta.default ?? ""}
        onChange={(e) => setParam(cid, name, e.target.value)}
      />
    );
  };

  return (
    <div>
      {items.map((c) => {
        const checked = !!value[c.id];
        const meta = c.paramsMeta;
        return (
          <div key={c.id} style={{ border: "1px solid #eee", padding: 12, marginBottom: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
              <strong>{c.label}</strong>
            </label>

            {checked && meta?.type === "object" && (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {Object.entries(meta.fields).map(([k, m]: any) => (
                  <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <small>{k}</small>
                    <Field cid={c.id} name={k} meta={m} />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

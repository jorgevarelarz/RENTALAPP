import React, { useState } from "react";
import { createTicket } from "../../api/tickets";
import { useNotify } from "../../utils/notify";
import { sendEmail } from "../../api/notify";

export default function TicketCreatePage() {
  const [form, setForm] = useState({
    contractId: "",
    service: "plumbing",
    title: "",
    description: "",
  });
  const [result, setResult] = useState<any>(null);
  const { push } = useNotify();

  const updateField = (key: string, value: any) =>
    setForm((state) => ({
      ...state,
      [key]: value,
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ticket = await createTicket(form);
      setResult(ticket);
      push("success", "Incidencia creada correctamente");
      try {
        await sendEmail(
          "notificaciones@rental-app.test",
          "Nueva incidencia creada",
          `Se ha creado la incidencia ${ticket._id || "sin ID"}.`
        );
      } catch (error) {
        console.warn("No se pudo disparar el email de incidencia", error);
      }
    } catch (err: any) {
      push("error", err?.response?.data?.error || "No se pudo crear la incidencia");
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "24px auto" }}>
      <h2>Abrir incidencia</h2>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Contract ID"
          value={form.contractId}
          onChange={(e) => updateField("contractId", e.target.value)}
          required
        />
        <select
          value={form.service}
          onChange={(e) => updateField("service", e.target.value)}
        >
          <option value="plumbing">Fontanería</option>
          <option value="electricity">Electricidad</option>
          <option value="appliances">Electrodomésticos</option>
          <option value="painting">Pintura</option>
        </select>
        <input
          placeholder="Título"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          required
        />
        <textarea
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={5}
        />
        <button type="submit">Crear</button>
      </form>
      {result && (
        <pre style={{ background: "#fafafa", padding: 12, marginTop: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

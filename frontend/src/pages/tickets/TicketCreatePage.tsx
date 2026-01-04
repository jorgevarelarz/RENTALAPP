import React, { useEffect, useState } from "react";
import { createTicket } from "../../services/tickets";
import { listContracts } from "../../services/contracts";
import { useAuth } from "../../context/AuthContext";
import { useNotify } from "../../utils/notify";
import { sendEmail } from "../../services/notify";

export default function TicketCreatePage() {
  const { token } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [form, setForm] = useState({
    contractId: "",
    ownerId: "",
    propertyId: "",
    service: "plumbing",
    title: "",
    description: "",
  });
  const [result, setResult] = useState<any>(null);
  const { push } = useNotify();

  useEffect(() => {
    const loadContracts = async () => {
      if (!token) return;
      try {
        const res = await listContracts(token, { status: 'active' });
        setContracts(res.items || []);
      } catch (error) {
        console.error(error);
      }
    };
    loadContracts();
  }, [token]);

  const updateField = (key: string, value: any) =>
    setForm((state) => ({
      ...state,
      [key]: value,
    }));

  const handleContractChange = (value: string) => {
    const selected = contracts.find((c) => String(c._id) === value);
    const property = selected?.property && typeof selected.property === 'object' ? selected.property : null;
    updateField("contractId", value);
    updateField("ownerId", selected?.ownerId || selected?.landlord || "");
    updateField("propertyId", property?._id || selected?.property || "");
  };

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
        <select
          value={form.contractId}
          onChange={(e) => handleContractChange(e.target.value)}
          required
        >
          <option value="">Selecciona contrato activo</option>
          {contracts.map((c) => {
            const property = c.property && typeof c.property === 'object' ? c.property : null;
            const label = property?.title || property?.address || c.propertyAddress || c._id;
            return (
              <option key={c._id} value={c._id}>
                {label}
              </option>
            );
          })}
        </select>
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

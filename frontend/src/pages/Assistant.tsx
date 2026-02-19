import React, { useState } from "react";
import { queryAssistant } from "../services/assistant";

export default function AssistantPage() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setLoading(true);
      setError("");
      const res = await queryAssistant(query.trim());
      setAnswer(res.answer || "");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "No se pudo consultar al asistente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Asistente Clara</h1>
      <p style={{ color: "#475569" }}>
        Consulta contratos, pagos, incidencias y contexto legal disponible en tu cuenta.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={5}
          placeholder="Ejemplo: ¿Cuál es el estado de mis contratos y pagos pendientes?"
          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}
        />
        <div>
          <button
            type="submit"
            disabled={loading}
            style={{ borderRadius: 8, padding: "10px 14px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff" }}
          >
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </form>

      {error ? (
        <div style={{ color: "#b91c1c", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: 12 }}>
          {error}
        </div>
      ) : null}

      {answer ? (
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#fff" }}>
          {answer}
        </div>
      ) : null}
    </div>
  );
}

import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const next = (loc.state as any)?.from || "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      nav(next, { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Error de login");
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{ maxWidth: 360, margin: "64px auto", display: "grid", gap: 12 }}
    >
      <h2>Entrar</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        placeholder="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      <button type="submit">Acceder</button>
    </form>
  );
}

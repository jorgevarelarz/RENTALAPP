import React, { useState } from "react";
import { requestPasswordReset } from "../../api/auth";

const containerStyle: React.CSSProperties = {
  maxWidth: 360,
  margin: "64px auto",
  padding: 24,
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "#fff",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  padding: "10px 16px",
  backgroundColor: "#1890ff",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  marginTop: 8,
  border: "1px solid #ccc",
  borderRadius: 4,
};

const messageStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 14,
};

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus("idle");
    try {
      await requestPasswordReset(email);
      setStatus("success");
    } catch (error) {
      console.error("Error requesting password reset", error);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <h2>Recuperar contraseña</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={buttonStyle} disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      {status === "success" && (
        <p style={{ ...messageStyle, color: "#389e0d" }}>
          Si el email existe, recibirás un link para restablecer tu contraseña.
        </p>
      )}
      {status === "error" && (
        <p style={{ ...messageStyle, color: "#cf1322" }}>
          Ha ocurrido un error al solicitar el reseteo. Inténtalo de nuevo más tarde.
        </p>
      )}
    </div>
  );
};

export default ForgotPassword;

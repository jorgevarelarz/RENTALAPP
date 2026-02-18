import React from "react";

type KycCameraCaptureProps = {
  onCapture?: (imageBase64: string) => void;
};

export default function KycCameraCapture({ onCapture }: KycCameraCaptureProps) {
  const handleMockCapture = () => {
    if (onCapture) onCapture("");
  };

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <h3>Captura de documento</h3>
      <p>La captura por camara no esta habilitada en esta version.</p>
      <button type="button" onClick={handleMockCapture}>
        Continuar
      </button>
    </div>
  );
}

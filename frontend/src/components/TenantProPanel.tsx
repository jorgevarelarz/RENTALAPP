import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TenantProInfo,
  acceptTenantProConsent,
  getTenantProInfo,
  uploadTenantProDoc,
} from '../services/tenantPro';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'nomina', label: 'Nómina' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'renta', label: 'Declaración de la renta' },
  { value: 'autonomo', label: 'Ingresos autónomo' },
  { value: 'otros', label: 'Otros' },
];

type Props = {
  requiredRent?: number;
};

export default function TenantProPanel({ requiredRent }: Props) {
  const { user } = useAuth();
  const [info, setInfo] = useState<TenantProInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const [docType, setDocType] = useState('nomina');
  const [uploading, setUploading] = useState(false);

  const loadInfo = async () => {
    if (!user || user.role !== 'tenant') return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantProInfo();
      setInfo(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la información PRO');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  if (!user || user.role !== 'tenant') {
    return null;
  }

  const badge = info?.status === 'verified' ? (
    <div style={{
      background: '#dcfce7',
      color: '#15803d',
      padding: '8px 12px',
      borderRadius: 8,
      fontWeight: 600,
      display: 'inline-block',
      marginBottom: 12,
    }}>
      Inquilino PRO – validado hasta {info?.maxRent ?? 0} €/mes
    </div>
  ) : null;

  const needsUpgrade = requiredRent && (info?.maxRent ?? 0) < requiredRent;

  const startFlow = () => {
    setShowFlow(true);
  };

  const handleConsent = async () => {
    await acceptTenantProConsent('v1');
    await loadInfo();
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      await uploadTenantProDoc(docType, file);
      await loadInfo();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #d4d4d8', padding: 16, borderRadius: 10, display: 'grid', gap: 12 }}>
      <strong>Programa Inquilino PRO</strong>
      {badge}
      {loading && <div>Cargando estado…</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      {!loading && !badge && (
        <p style={{ margin: 0, color: '#4b5563' }}>
          Sube tu documentación una vez y solicita viviendas exclusivas para inquilinos PRO.
        </p>
      )}
      {needsUpgrade && (
        <div style={{ color: '#b91c1c', fontWeight: 500 }}>
          Esta vivienda requiere validación ≥ {requiredRent} €/mes.
        </div>
      )}
      {!showFlow && (
        <button
          type="button"
          onClick={startFlow}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Hazte PRO gratis
        </button>
      )}
      {showFlow && (
        <div style={{ display: 'grid', gap: 8 }}>
          {!info?.consentAccepted && (
            <button
              type="button"
              onClick={handleConsent}
              style={{
                background: '#111827',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Aceptar consentimiento (v1)
            </button>
          )}
          {info?.consentAccepted && (
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Tipo de documento</span>
                <select value={docType} onChange={e => setDocType(e.target.value)}>
                  {DOC_TYPES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Documento cifrado (máx. 10 MB)</span>
                <input
                  type="file"
                  onChange={e => handleUpload(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
              </label>
              {uploading && <div>Subiendo…</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

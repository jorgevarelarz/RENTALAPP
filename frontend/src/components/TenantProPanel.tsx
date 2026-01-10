import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TenantProInfo, acceptTenantProConsent, getTenantProInfo, uploadTenantProDoc } from '../services/tenantPro';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

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
  const qc = useQueryClient();
  const { data: info, isLoading: loading, error, refetch } = useQuery<TenantProInfo>({
    queryKey: ['tenant-pro/me'],
    queryFn: getTenantProInfo,
    enabled: !!user && user.role === 'tenant',
    staleTime: 10_000,
  });
  const [showFlow, setShowFlow] = useState(false);
  const [docType, setDocType] = useState('nomina');
  const uploadMut = useMutation({
    mutationFn: async (file: File) => uploadTenantProDoc(docType, file),
    onSuccess: async () => {
      toast.success('Documento subido');
      await qc.invalidateQueries({ queryKey: ['tenant-pro/me'] });
    },
    onError: () => toast.error('No se pudo subir el documento'),
  });
  const consentMut = useMutation({
    mutationFn: async () => acceptTenantProConsent('v1'),
    onSuccess: async () => {
      toast.success('Consentimiento aceptado');
      await qc.invalidateQueries({ queryKey: ['tenant-pro/me'] });
    },
    onError: () => toast.error('No se pudo registrar el consentimiento'),
  });

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
      Tenant PRO – validado hasta {info?.maxRent ?? 0} €/mes
    </div>
  ) : null;

  const needsUpgrade = requiredRent && (info?.maxRent ?? 0) < requiredRent;

  const startFlow = () => {
    setShowFlow(true);
  };

  const handleConsent = async () => { consentMut.mutate(); };

  const handleUpload = async (file: File | null) => { if (file) uploadMut.mutate(file); };

  return (
    <div style={{ border: '1px solid #d4d4d8', padding: 16, borderRadius: 10, display: 'grid', gap: 12 }}>
      <strong>Programa Tenant PRO</strong>
      {badge}
      {loading && <div>Cargando estado…</div>}
      {error && (
        <div style={{ color: '#ef4444' }}>
          {(error as any)?.message || 'Error'}
          <div><button onClick={() => refetch()}>Reintentar</button></div>
        </div>
      )}
      {!loading && !badge && (
        <p style={{ margin: 0, color: '#4b5563' }}>
          Sube tu documentación una vez y solicita viviendas exclusivas para Tenant PRO.
        </p>
      )}
      {!!info?.consentAccepted && (info as any)?.docs?.length === 0 && (
        <div style={{ color: '#6b7280' }}>Aún no has subido documentación. Sube tu nómina, contrato, etc. para obtener el badge Tenant PRO.</div>
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
          Hazte Tenant PRO gratis
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
              {uploadMut.isPending && <div>Subiendo…</div>}
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Conservamos esta documentación durante {(info as any)?.ttlDays ?? 365} días; puedes eliminarla cuando quieras desde tu perfil.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

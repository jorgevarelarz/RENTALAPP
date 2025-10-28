import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { acceptTenantProConsent, getTenantProInfo, purgeTenantPro, uploadTenantProDoc } from '../../api/tenantPro';
import { TenantProInfo } from '../../api/tenantPro';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'nomina', label: 'Nómina' },
  { value: 'contrato', label: 'Contrato laboral o alquiler vigente' },
  { value: 'renta', label: 'Declaración de la renta' },
  { value: 'autonomo', label: 'Ingresos como autónomo' },
  { value: 'otros', label: 'Otros justificantes' },
];

function statusExplanation(info?: TenantProInfo) {
  const status = info?.status ?? 'none';
  if (status === 'verified') {
    return '¡Enhorabuena! Tu solvencia está verificada y puedes optar a viviendas Only PRO.';
  }
  if (status === 'pending') {
    return 'Estamos revisando tu documentación. Te avisaremos en cuanto haya una decisión.';
  }
  if (status === 'rejected') {
    return 'Tu solicitud fue rechazada. Revisa la documentación y vuelve a enviarla cuando lo tengas todo listo.';
  }
  return 'Sube documentos para acreditar tus ingresos y acceder a viviendas exclusivas.';
}

const TenantProBadgePage: React.FC = () => {
  const qc = useQueryClient();
  const { data: info, isLoading, error } = useQuery<TenantProInfo>({
    queryKey: ['tenant-pro/me'],
    queryFn: getTenantProInfo,
    staleTime: 30_000,
  });
  const [docType, setDocType] = useState('nomina');

  const consentMutation = useMutation({
    mutationFn: async () => acceptTenantProConsent(info?.consentTextVersion || 'v1'),
    onSuccess: async () => {
      toast.success('Consentimiento aceptado');
      await qc.invalidateQueries({ queryKey: ['tenant-pro/me'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'No se pudo aceptar el consentimiento'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: { type: string; file: File }) => uploadTenantProDoc(payload.type, payload.file),
    onSuccess: async () => {
      toast.success('Documento subido correctamente');
      await qc.invalidateQueries({ queryKey: ['tenant-pro/me'] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === 'file_too_large') toast.error('Archivo demasiado grande (máx 10 MB).');
      else if (code === 'unsupported_mime') toast.error('Formato no permitido. Usa PDF, JPG o PNG.');
      else toast.error(err?.response?.data?.message || 'No se pudo subir el documento');
    },
  });

  const purgeMutation = useMutation({
    mutationFn: async () => purgeTenantPro(),
    onSuccess: async () => {
      toast.success('Documentación eliminada');
      await qc.invalidateQueries({ queryKey: ['tenant-pro/me'] });
    },
    onError: () => toast.error('No se pudo eliminar la documentación'),
  });

  const docs = info?.docs ?? [];
  const ttlDays = info?.ttlDays ?? 365;
  const allowUploads = info?.consentAccepted;

  const purgeDisabled = useMemo(() => purgeMutation.isPending, [purgeMutation.isPending]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Solvencia PRO</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Demuestra tus ingresos y accede a viviendas Only PRO según tu capacidad de pago.
        </p>
      </header>

      <section style={cardStyle}>
        {isLoading && <p>Cargando estado…</p>}
        {error && <p style={{ color: '#b91c1c' }}>No se pudo obtener tu estado actual.</p>}
        {!isLoading && info && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <strong>Estado:</strong> {info.status ?? 'none'}
              {info.status === 'verified' && (
                <span style={{ marginLeft: 8, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 6 }}>
                  Verificado · Hasta {info.maxRent?.toLocaleString('es-ES') ?? 0} €/mes
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: '#475569' }}>{statusExplanation(info)}</p>
            {info.lastDecisionAt && (
              <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                Última decisión: {new Date(info.lastDecisionAt).toLocaleDateString('es-ES')}
              </p>
            )}
            <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>
              Conservamos tus documentos durante {ttlDays} días desde la última revisión. Puedes eliminarlos cuando quieras.
            </p>
          </div>
        )}
      </section>

      {!info?.consentAccepted && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>1. Acepta el consentimiento</h2>
          <p style={{ margin: '0 0 12px', color: '#475569' }}>
            Necesitamos tu consentimiento para almacenar y procesar la documentación de solvencia.
          </p>
          <button
            type="button"
            onClick={() => consentMutation.mutate()}
            disabled={consentMutation.isPending}
            style={primaryButton}
          >
            {consentMutation.isPending ? 'Enviando…' : 'Aceptar y continuar'}
          </button>
        </section>
      )}

      {allowUploads && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>2. Sube tu documentación</h2>
          <p style={{ margin: '0 0 12px', color: '#475569' }}>
            Adjunta al menos un justificante de ingresos. Aceptamos PDF, JPG o PNG (máx. 10 MB por archivo).
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Tipo de documento</span>
              <select value={docType} onChange={event => setDocType(event.target.value)} style={selectStyle}>
                {DOC_TYPES.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Archivo</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) uploadMutation.mutate({ type: docType, file });
                }}
              />
            </label>
            {uploadMutation.isPending && <span>Subiendo documento…</span>}
          </div>
        </section>
      )}

      {docs.length > 0 && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Documentos enviados</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Subido</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={String(doc._id || doc.url)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{doc.type}</td>
                  <td style={tdStyle}>{doc.status}</td>
                  <td style={tdStyle}>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('es-ES') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => purgeMutation.mutate()}
            disabled={purgeDisabled}
            style={dangerButton}
          >
            {purgeMutation.isPending ? 'Eliminando…' : 'Eliminar documentación'}
          </button>
        </section>
      )}
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  background: '#fff',
  display: 'grid',
  gap: 12,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
};

const primaryButton: React.CSSProperties = {
  alignSelf: 'flex-start',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  cursor: 'pointer',
  fontWeight: 600,
};

const dangerButton: React.CSSProperties = {
  alignSelf: 'flex-end',
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  cursor: 'pointer',
  fontWeight: 600,
  marginTop: 12,
};

const selectStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #cbd5f5',
  padding: '8px 10px',
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 12,
  textTransform: 'uppercase',
  color: '#94a3b8',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
};

export default TenantProBadgePage;

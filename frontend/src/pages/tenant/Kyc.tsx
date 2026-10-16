import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const primaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90';
const secondaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';

// La verificación automática (Stripe Identity, /api/kyc) es todavía un stub: hoy la identidad la
// marca el equipo desde «Usuarios». La página dice el estado y qué se puede hacer mientras tanto,
// sin prometer un trámite que aún no existe.
export default function TenantKyc() {
  const { user } = useAuth();
  const verified = user?.isVerified !== false;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Verificación de identidad"
        subtitle="Antes de pedir visitas o firmar, el propietario tiene que saber con quién trata."
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-gray-950">Estado</h2>
          {verified ? <Badge tone="success">Verificada</Badge> : <Badge tone="warning">Sin verificar</Badge>}
        </div>

        {verified ? (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Tu identidad está verificada. Puedes pedir visitas, escribir a los propietarios, firmar contratos y pagar desde
            RentalApp.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-gray-600">
            <div>
              <p>Hasta que esté verificada no podrás:</p>
              <ul className="mt-1.5 list-disc pl-5">
                <li>pedir visitas ni enviar solicitudes;</li>
                <li>escribir a los propietarios;</li>
                <li>firmar contratos ni pagar la renta o la fianza.</li>
              </ul>
            </div>
            <p>
              Por ahora la verificación la hace el equipo de RentalApp; no tienes que subir nada desde esta página.
              Mientras tanto puedes buscar pisos, guardar favoritos y completar tu perfil.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/properties" className={primaryLink}>Buscar pisos</Link>
              <Link to="/profile" className={secondaryLink}>Completar perfil</Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

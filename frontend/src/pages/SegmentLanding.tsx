import { Link, Navigate, useParams } from 'react-router-dom';
import { Building2, FileSignature, Home, Landmark, ShieldCheck, Wrench } from 'lucide-react';

const pages = {
  inquilinos: {
    icon: Home,
    title: 'RentalApp para inquilinos',
    lead: 'Encuentra vivienda, presenta solicitudes ordenadas y usa Tenant PRO para demostrar solvencia sin reenviar documentos cada vez.',
    cta: 'Buscar vivienda',
    to: '/properties',
    benefits: ['Búsqueda con favoritos y solicitudes', 'Perfil Tenant PRO verificable', 'Contratos, pagos e incidencias en un solo panel'],
    steps: ['Busca y guarda viviendas', 'Envía solicitud y documentación', 'Firma, paga y gestiona incidencias'],
  },
  propietarios: {
    icon: Building2,
    title: 'RentalApp para propietarios',
    lead: 'Publica propiedades, compara candidatos, firma contratos digitales y controla pagos, recibos e incidencias.',
    cta: 'Publicar propiedad',
    to: '/register?role=landlord',
    benefits: ['Publicación guiada de inmuebles', 'Candidatos y Tenant PRO visibles', 'Firma, cobros e historial operativo'],
    steps: ['Publica la vivienda', 'Revisa solicitudes', 'Firma contrato y gestiona el alquiler'],
  },
  profesionales: {
    icon: Wrench,
    title: 'RentalApp para profesionales',
    lead: 'Recibe incidencias de mantenimiento, envía presupuestos, coordina trabajos y controla facturación desde tu panel.',
    cta: 'Entrar como pro',
    to: '/register?role=pro',
    benefits: ['Tickets asignados por servicio', 'Presupuestos y extras aprobables', 'Panel de facturación y CSV'],
    steps: ['Crea tu perfil profesional', 'Recibe incidencias', 'Presupuesta, ejecuta y factura'],
  },
  agencias: {
    icon: ShieldCheck,
    title: 'Programa de agencias RentalApp',
    lead: 'Da de alta propietarios, opera carteras y genera comisiones recurrentes por contratos captados o gestionados.',
    cta: 'Solicitar acceso agencia',
    to: '/login',
    benefits: ['Invitación de propietarios', 'Funnel de captación por cliente', 'Comisiones por tramo e informes'],
    steps: ['RentalApp activa tu agencia', 'Invitas propietarios', 'Gestionas cartera y cobras comisiones'],
  },
  compliance: {
    icon: Landmark,
    title: 'Compliance y auditoría de alquiler',
    lead: 'Consulta zonas tensionadas, evidencias de contratos, políticas aceptadas y métricas agregadas para operación regulada.',
    cta: 'Ver compliance',
    to: '/login',
    benefits: ['Dashboard de riesgos legales', 'Export CSV/PDF auditable', 'Trazabilidad de eventos y contratos'],
    steps: ['Configura zonas y reglas', 'Audita contratos', 'Exporta evidencias y reportes'],
  },
} as const;

export default function SegmentLanding() {
  const { segment = '' } = useParams();
  const page = pages[segment as keyof typeof pages];
  if (!page) return <Navigate to="/" replace />;
  const Icon = page.icon;

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <Icon className="h-9 w-9 text-indigo-600" />
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">{page.title}</h1>
        <p className="mt-5 max-w-3xl text-lg text-gray-600">{page.lead}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={page.to} className="rounded-md bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
            {page.cta}
          </Link>
          <Link to="/" className="rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
            Volver al inicio
          </Link>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {page.benefits.map((benefit) => (
            <div key={benefit} className="rounded-lg border border-gray-200 bg-white p-5">
              <FileSignature className="h-5 w-5 text-indigo-600" />
              <p className="mt-3 font-semibold text-gray-950">{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-gray-950">Cómo funciona</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {page.steps.map((step, index) => (
            <div key={step} className="rounded-lg border border-gray-200 p-5">
              <p className="text-3xl font-bold text-gray-950">{index + 1}</p>
              <p className="mt-2 text-sm text-gray-600">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

import { Link } from 'react-router-dom';
import { Building2, FileSignature, Home, Landmark, ShieldCheck, Wrench } from 'lucide-react';

const segments = [
  {
    title: 'Inquilinos',
    text: 'Busca viviendas, guarda favoritas, solicita visitas y presenta un perfil Tenant PRO verificable.',
    cta: 'Buscar vivienda',
    to: '/info/inquilinos',
    icon: Home,
    tone: 'blue',
  },
  {
    title: 'Propietarios',
    text: 'Publica inmuebles, compara candidatos, firma contratos y centraliza pagos e incidencias.',
    cta: 'Publicar propiedad',
    to: '/info/propietarios',
    icon: Building2,
    tone: 'emerald',
  },
  {
    title: 'Profesionales',
    text: 'Recibe trabajos de mantenimiento, envía presupuestos y cobra servicios con trazabilidad.',
    cta: 'Entrar como pro',
    to: '/info/profesionales',
    icon: Wrench,
    tone: 'orange',
  },
  {
    title: 'Agencias',
    text: 'Opera carteras, delega permisos, invita clientes y controla contratos desde un panel único.',
    cta: 'Programa agencias',
    to: '/info/agencias',
    icon: ShieldCheck,
    tone: 'slate',
  },
  {
    title: 'Instituciones',
    text: 'Consulta cumplimiento, zonas tensionadas y métricas agregadas con exportaciones auditables.',
    cta: 'Ver compliance',
    to: '/info/compliance',
    icon: Landmark,
    tone: 'violet',
  },
];

const features = [
  ['Contrato digital', 'Plantillas, cláusulas, firma y evidencias en un mismo flujo.'],
  ['Alquiler seguro', 'KYC, Tenant PRO, auditoría y estados claros para reducir riesgo operativo.'],
  ['Operación diaria', 'Pagos, recibos, incidencias, chat y reporting sin hojas sueltas.'],
];

const toneClass: Record<string, string> = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  orange: 'text-orange-600',
  slate: 'text-slate-600',
  violet: 'text-violet-600',
};

export default function LandingPage() {
  return (
    <main className="bg-white">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">RentalApp 1.0</p>
            <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight text-gray-950">
              La plataforma operativa para alquileres completos.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-gray-600">
              Publicación, candidatos, contratos, firma, pagos, incidencias, profesionales y compliance en una sola app.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/info/inquilinos" className="inline-flex items-center justify-center rounded-md bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                Buscar vivienda
              </Link>
              <Link to="/info/propietarios" className="inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                Publicar propiedad
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
            <div className="grid gap-3">
              {features.map(([title, text]) => (
                <div key={title} className="flex gap-3 rounded-md bg-white p-4 border border-gray-100">
                  <FileSignature className="mt-0.5 h-5 w-5 text-indigo-600 shrink-0" />
                  <div>
                    <h2 className="font-semibold text-gray-950">{title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {segments.map(({ title, text, cta, to, icon: Icon, tone }) => (
              <article key={title} className="rounded-lg border border-gray-200 bg-white p-5">
                <Icon className={`h-6 w-6 ${toneClass[tone]}`} />
                <h2 className="mt-4 text-lg font-semibold text-gray-950">{title}</h2>
                <p className="mt-2 min-h-24 text-sm text-gray-600">{text}</p>
                <Link to={to} className="mt-4 inline-flex text-sm font-semibold text-gray-950 hover:underline">
                  {cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-3xl font-bold text-gray-950">1</p>
            <p className="mt-1 text-sm text-gray-600">Publica, busca o entra como profesional.</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-950">2</p>
            <p className="mt-1 text-sm text-gray-600">Valida perfiles, solicitudes, contratos y presupuestos.</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-950">3</p>
            <p className="mt-1 text-sm text-gray-600">Firma, cobra, resuelve incidencias y audita la operación.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

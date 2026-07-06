import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  FileSignature,
  Home,
  Landmark,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react';

const segments = [
  {
    title: 'Inquilinos',
    text: 'Busca vivienda, destaca con un perfil Tenant PRO verificado y firma sin reenviar papeles.',
    cta: 'Buscar vivienda',
    to: '/info/inquilinos',
    icon: Home,
    tone: 'blue',
    img: '/images/landing/inquilinos-hero.webp',
    alt: 'Pareja joven desembalando cajas en el salón de su nuevo piso de alquiler',
  },
  {
    title: 'Propietarios',
    text: 'Publica, compara candidatos con solvencia real y cobra la renta en piloto automático.',
    cta: 'Publicar propiedad',
    to: '/info/propietarios',
    icon: Building2,
    tone: 'emerald',
    img: '/images/landing/propietarios-hero.webp',
    alt: 'Propietario entregando las llaves de la vivienda a una pareja de inquilinos',
  },
  {
    title: 'Profesionales',
    text: 'Recibe trabajos de mantenimiento, envía presupuestos y cobra con trazabilidad.',
    cta: 'Entrar como pro',
    to: '/info/profesionales',
    icon: Wrench,
    tone: 'orange',
    img: '/images/landing/profesionales-hero.webp',
    alt: 'Profesional de mantenimiento trabajando en una vivienda',
  },
  {
    title: 'Agencias',
    text: 'Opera carteras completas, delega permisos e invita clientes desde un panel único.',
    cta: 'Programa agencias',
    to: '/info/agencias',
    icon: ShieldCheck,
    tone: 'slate',
    img: '/images/landing/agencias-hero.webp',
    alt: 'Equipo de una agencia inmobiliaria trabajando en la oficina',
  },
  {
    title: 'Instituciones',
    text: 'Cumplimiento, zonas tensionadas y métricas agregadas con exportaciones auditables.',
    cta: 'Ver compliance',
    to: '/info/compliance',
    icon: Landmark,
    tone: 'violet',
    img: '/images/landing/compliance-hero.webp',
    alt: 'Vista aérea de una ciudad con edificios residenciales',
  },
];

const features = [
  {
    icon: FileSignature,
    title: 'Contrato digital',
    text: 'Plantillas al día con la LAU, firma electrónica con validez legal y evidencias archivadas en el mismo flujo.',
  },
  {
    icon: ShieldCheck,
    title: 'Alquiler seguro',
    text: 'KYC, solvencia verificada con Tenant PRO y estados claros para reducir el riesgo antes de firmar.',
  },
  {
    icon: Wallet,
    title: 'Operación diaria',
    text: 'Pagos con recibo automático, incidencias con seguimiento, chat y reporting sin hojas sueltas.',
  },
];

const steps = [
  {
    title: 'Entra con tu perfil',
    text: 'Publica una vivienda, busca piso o date de alta como profesional o agencia. Cada perfil tiene su panel.',
  },
  {
    title: 'Valida con datos',
    text: 'Candidatos con solvencia verificada, presupuestos comparables y contratos generados con criterio.',
  },
  {
    title: 'Firma y opera',
    text: 'Firma digital, cobros automáticos, incidencias resueltas por profesionales y todo el histórico auditable.',
  },
];

const toneClass: Record<string, { accent: string; soft: string }> = {
  blue: { accent: 'text-blue-600', soft: 'bg-blue-50' },
  emerald: { accent: 'text-emerald-600', soft: 'bg-emerald-50' },
  orange: { accent: 'text-orange-600', soft: 'bg-orange-50' },
  slate: { accent: 'text-slate-600', soft: 'bg-slate-100' },
  violet: { accent: 'text-violet-600', soft: 'bg-violet-50' },
};

export default function LandingPage() {
  useEffect(() => {
    document.title = 'RentalApp — Alquiler de viviendas con contratos digitales y pagos protegidos';
    return () => {
      document.title = 'RentalApp';
    };
  }, []);

  return (
    <main className="bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">RentalApp</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-950 sm:text-6xl">
              El alquiler, sin fricción de principio a fin.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-gray-600">
              Publicación, candidatos verificados, contrato digital, firma, pagos, incidencias y compliance en una
              sola app. Para inquilinos, propietarios, profesionales, agencias e instituciones.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/info/inquilinos"
                className="inline-flex items-center justify-center rounded-md bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Buscar vivienda
              </Link>
              <Link
                to="/info/propietarios"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Publicar propiedad
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src="/images/landing/propietarios-hero.webp"
              alt="Propietario entregando las llaves de la vivienda a una pareja de inquilinos en el salón"
              width={800}
              height={533}
              className="aspect-[3/2] w-full rounded-xl object-cover shadow-lg"
            />
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-md">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50">
                <BadgeCheck className="h-5 w-5 text-indigo-600" />
              </span>
              <div>
                <p className="text-xs font-medium text-gray-500">Contrato firmado</p>
                <p className="text-sm font-semibold text-gray-950">Fianza y renta protegidas ✓</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Qué resuelve */}
      <section className="border-y border-indigo-100 bg-indigo-50/60 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: FeatureIcon, title, text }) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                  <FeatureIcon className="h-5 w-5 text-indigo-600" />
                </span>
                <h2 className="mt-4 font-semibold text-gray-950">{title}</h2>
                <p className="mt-2 text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Una plataforma, cinco perfiles</h2>
        <p className="mt-2 max-w-2xl text-gray-600">
          Cada perfil tiene su propio panel y su propia página. Elige el tuyo y mira cómo funciona.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map(({ title, text, cta, to, icon: Icon, tone, img, alt }) => (
            <Link
              key={title}
              to={to}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[5/3] overflow-hidden">
                <img
                  src={img}
                  alt={alt}
                  width={500}
                  height={300}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass[tone].soft}`}>
                    <Icon className={`h-5 w-5 ${toneClass[tone].accent}`} />
                  </span>
                  <h3 className="text-lg font-semibold text-gray-950">{title}</h3>
                </div>
                <p className="mt-3 text-sm text-gray-600">{text}</p>
                <p className="mt-4 text-sm font-semibold text-gray-950 group-hover:underline">{cta} →</p>
              </div>
            </Link>
          ))}
          <div className="flex flex-col justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <h3 className="text-lg font-semibold text-gray-950">¿No sabes por dónde empezar?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Crea tu cuenta gratis y la app te guía según lo que necesites: buscar, publicar o trabajar.
            </p>
            <Link to="/register" className="mt-4 text-sm font-semibold text-indigo-600 hover:underline">
              Crear cuenta gratis →
            </Link>
          </div>
        </div>
      </section>

      {/* Banda con imagen */}
      <section className="relative overflow-hidden">
        <img
          src="/images/landing/propietarios-edificio.webp"
          alt=""
          width={1400}
          height={500}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative bg-gradient-to-r from-gray-950/85 via-gray-950/60 to-gray-950/40 py-14">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <p className="text-3xl font-bold text-white">100% digital</p>
              <p className="mt-1 text-sm text-white/80">de la solicitud a la firma y los cobros</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">5 perfiles</p>
              <p className="mt-1 text-sm text-white/80">inquilino, propietario, pro, agencia e institución</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">0 papeles</p>
              <p className="mt-1 text-sm text-white/80">contratos, recibos e incidencias con registro auditable</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Cómo funciona</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-gray-200 p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold text-gray-950">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-gray-100 bg-gray-50 py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-950">Tu próximo alquiler empieza aquí</h2>
            <p className="mt-2 text-gray-600">Crea tu cuenta gratis y gestiona todo el alquiler desde un solo sitio.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/register" className="rounded-md bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              Crear cuenta gratis
            </Link>
            <Link to="/properties" className="rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
              Ver viviendas
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

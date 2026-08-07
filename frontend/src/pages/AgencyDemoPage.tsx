import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  MoveRight,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import PublicFooter from '../components/PublicFooter';
import { useDocumentTitle } from '../utils/useDocumentTitle';

type JourneyStep = {
  number: string;
  icon: LucideIcon;
  title: string;
  text: string;
  detail: string;
};

const journeySteps: JourneyStep[] = [
  {
    number: '01',
    icon: UsersRound,
    title: 'Activa al propietario',
    text: 'La agencia prepara una invitación con sus datos y la vivienda. El propietario recibe el enlace y crea su propia cuenta.',
    detail: 'La atribución de captación queda registrada desde el primer paso.',
  },
  {
    number: '02',
    icon: Building2,
    title: 'Prepara la vivienda',
    text: 'La agencia puede crear y gestionar la ficha del inmueble mientras acompaña al propietario en la puesta en marcha.',
    detail: 'Cuenta, verificación, propiedad y contrato se siguen como hitos del alta.',
  },
  {
    number: '03',
    icon: KeyRound,
    title: 'Entrega el control',
    text: 'Cuando todo está listo, la propiedad se cede al propietario para que continúe la gestión directamente en RentalApp.',
    detail: 'La agencia pasa a acceso de solo estado: mantiene visibilidad, no capacidad de edición.',
  },
  {
    number: '04',
    icon: CircleDollarSign,
    title: 'Participa de cada renta',
    text: 'Mientras el contrato atribuido siga activo y sus cobros se procesen en RentalApp, la agencia recibe su porcentaje vigente.',
    detail: 'El porcentaje se aplica sobre la comisión de plataforma, no sobre la renta completa.',
  },
];

const statusItems = [
  { label: 'Cuenta creada', done: true },
  { label: 'DNI verificado', done: true },
  { label: 'Propiedad publicada', done: true },
  { label: 'Contrato activo', done: false },
];

const safeguards = [
  'Una sola agencia recibe la atribución por contrato.',
  'La cesión corta la edición de la agencia, pero conserva el seguimiento de estado.',
  'Los movimientos reflejan cobros de renta procesados y la base de comisión correspondiente.',
  'La autofactura se descarga en PDF para el mes seleccionado.',
];

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label="Ejemplo visual del panel de agencia">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-blue-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white p-3 shadow-2xl shadow-black/30 sm:p-4">
        <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                <LayoutDashboard size={14} aria-hidden="true" /> Panel de agencia
              </div>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-950">Resumen de colaboración</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Datos de ejemplo
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] leading-tight text-slate-500">Este mes</p>
              <p className="mt-2 text-base font-bold text-slate-950 sm:text-xl">426,40 €</p>
              <p className="mt-1 text-[10px] text-slate-400">8 movimientos</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] leading-tight text-slate-500">Contratos activos</p>
              <p className="mt-2 text-base font-bold text-slate-950 sm:text-xl">18</p>
              <p className="mt-1 text-[10px] text-slate-400">atribuidos</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold leading-tight text-blue-700">
                <TrendingUp size={11} aria-hidden="true" /> Tramo
              </p>
              <p className="mt-2 text-base font-bold text-blue-700 sm:text-xl">Vigente</p>
              <p className="mt-1 text-[10px] text-blue-600">según cartera</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_.9fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-950">Elena Martínez</p>
                  <p className="text-[10px] text-slate-500">C/ Marqués de Campo, 24</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Activa</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {statusItems.map((item) => (
                  <span key={item.label} className={`flex items-center gap-1 text-[10px] font-semibold ${item.done ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {item.done ? <CheckCircle2 size={12} aria-hidden="true" /> : <span className="h-3 w-3 rounded-full border border-slate-300" aria-hidden="true" />}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-slate-950 p-3.5 text-white">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold">Movimiento reciente</p>
                <BadgeCheck size={14} className="text-[#d9ff69]" aria-hidden="true" />
              </div>
              <p className="mt-4 text-2xl font-bold">53,30 €</p>
              <p className="mt-1 text-[10px] text-slate-400">Participación sobre fee de plataforma</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-3/4 rounded-full bg-[#d9ff69]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneyCard({ step }: { step: JourneyStep }) {
  const Icon = step.icon;
  return (
    <article className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5">
      <div className="flex items-center justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-[#d9ff69]">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="text-sm font-bold tracking-[0.18em] text-slate-300">{step.number}</span>
      </div>
      <h3 className="mt-7 text-xl font-bold tracking-tight text-slate-950">{step.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{step.text}</p>
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-semibold leading-5 text-blue-700">{step.detail}</p>
    </article>
  );
}

export default function AgencyDemoPage() {
  useDocumentTitle('Agencias · demo guiada');

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-[#0b1025]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand inverse />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-300 md:flex" aria-label="Navegación de la demo para agencias">
            <a href="#recorrido" className="transition hover:text-white hover:opacity-100">Recorrido</a>
            <a href="#cesion" className="transition hover:text-white hover:opacity-100">Cesión</a>
            <a href="#ingresos" className="transition hover:text-white hover:opacity-100">Ingresos</a>
            <a href="#panel" className="transition hover:text-white hover:opacity-100">Panel</a>
          </nav>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white hover:text-slate-950 hover:opacity-100"
          >
            Acceder <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#0b1025] px-4 pb-24 pt-36 text-white sm:px-6 sm:pb-28 sm:pt-40 lg:px-8 lg:pb-32">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,rgba(67,104,255,.42),transparent_30%),radial-gradient(circle_at_85%_70%,rgba(217,255,105,.12),transparent_24%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_.98fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d9ff69]/25 bg-[#d9ff69]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#d9ff69]">
                <BadgeCheck size={14} aria-hidden="true" /> Demo comercial · agencias
              </p>
              <h1 className="mt-7 max-w-3xl text-5xl font-extrabold tracking-[-0.055em] sm:text-6xl lg:text-7xl lg:leading-[.98]">
                Abre la puerta. <span className="text-[#d9ff69]">Entrega el control.</span> Conserva el valor.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                RentalApp permite a tu agencia acompañar al propietario desde el alta hasta la publicación y, después, cederle la gestión sin perder la atribución del contrato ni la visibilidad de su estado.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#recorrido"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d9ff69] px-6 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-white hover:opacity-100"
                >
                  Ver la demo guiada <MoveRight size={17} aria-hidden="true" />
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/10 hover:opacity-100"
                >
                  Ya soy agencia
                </Link>
              </div>
              <div className="mt-10 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {['Flujo ya operativo', 'Cesión con límites claros', 'Comisión trazable'].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check size={15} className="shrink-0 text-[#d9ff69]" aria-hidden="true" /> {item}
                  </span>
                ))}
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section id="recorrido" className="scroll-mt-8 bg-slate-50 px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">El recorrido real</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">Una captación que termina en autonomía, no en dependencia.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">Cuatro momentos conectados. Cada uno corresponde a una capacidad que ya existe en RentalApp.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {journeySteps.map((step) => <JourneyCard key={step.number} step={step} />)}
            </div>
          </div>
        </section>

        <section id="cesion" className="scroll-mt-8 px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">La cesión, explicada</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">La agencia deja de operar. El vínculo comercial permanece.</h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Al entregar la propiedad, el acceso de la agencia cambia de <strong className="text-slate-950">gestión</strong> a <strong className="text-slate-950">solo estado</strong>. El propietario continúa en su propia cuenta; la agencia conserva el seguimiento necesario para su cartera.
              </p>
              <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="flex items-center gap-2 font-bold text-blue-950"><ShieldCheck size={19} aria-hidden="true" /> Un límite de acceso explícito</p>
                <p className="mt-2 text-sm leading-6 text-blue-900/75">Tras la cesión, la agencia ya no puede editar, archivar ni operar el contrato. Puede ver el estado resumido de la propiedad atribuida.</p>
              </div>
            </div>

            <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/15 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <span className="inline-flex rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-300">Antes</span>
                  <p className="mt-5 text-lg font-bold">Gestión de agencia</p>
                  <ul className="mt-5 space-y-3 text-sm text-slate-300">
                    {['Crear la ficha', 'Editar la propiedad', 'Preparar la publicación'].map((item) => (
                      <li key={item} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-blue-400" aria-hidden="true" /> {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-center text-[#d9ff69]">
                  <ArrowRight className="rotate-90 sm:rotate-0" aria-hidden="true" />
                </div>
                <div className="rounded-2xl border border-[#d9ff69]/25 bg-[#d9ff69]/10 p-5">
                  <span className="inline-flex rounded-full bg-[#d9ff69] px-2.5 py-1 text-xs font-bold text-slate-950">Después</span>
                  <p className="mt-5 text-lg font-bold">Solo seguimiento</p>
                  <ul className="mt-5 space-y-3 text-sm text-slate-200">
                    {['Estado de la propiedad', 'Propietario asociado', 'Fecha de transferencia'].map((item) => (
                      <li key={item} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#d9ff69]" aria-hidden="true" /> {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ingresos" className="scroll-mt-8 bg-blue-600 px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-100">Ingresos recurrentes</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">El porcentaje se calcula donde corresponde.</h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">
                Por cada cobro de renta procesado para un contrato atribuido, RentalApp calcula su comisión de plataforma. Sobre esa comisión —no sobre la renta completa— aplica el porcentaje de colaboración vigente.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Contrato activo</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Cobro procesado</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2">Agencia atribuida</span>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/15 bg-white p-6 text-slate-950 shadow-2xl shadow-blue-950/20 sm:p-8">
              <p className="text-sm font-bold text-slate-500">Cómo se forma cada movimiento</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                <div className="rounded-2xl bg-slate-100 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-500">Renta procesada</p>
                  <p className="mt-2 text-lg font-extrabold">Cobro mensual</p>
                </div>
                <span className="text-center text-slate-300">→</span>
                <div className="rounded-2xl bg-blue-50 p-4 text-center">
                  <p className="text-xs font-semibold text-blue-600">Base</p>
                  <p className="mt-2 text-lg font-extrabold text-blue-950">Fee RentalApp</p>
                </div>
                <span className="text-center text-slate-300">×</span>
                <div className="rounded-2xl bg-slate-950 p-4 text-center text-white">
                  <p className="text-xs font-semibold text-[#d9ff69]">Resultado</p>
                  <p className="mt-2 text-lg font-extrabold">% agencia</p>
                </div>
              </div>
              <p className="mt-6 text-xs leading-5 text-slate-500">El porcentaje puede ser fijo o responder a tramos por volumen, según la configuración vigente de la colaboración.</p>
            </div>
          </div>
        </section>

        <section id="panel" className="scroll-mt-8 bg-slate-50 px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">Todo queda visible</p>
                <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">Un panel comercial que también cierra el mes.</h2>
                <p className="mt-6 text-lg leading-8 text-slate-600">La misma vista reúne el rendimiento de la cartera y la documentación que la agencia necesita para revisar su colaboración.</p>
                <ul className="mt-8 space-y-4">
                  {safeguards.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={13} aria-hidden="true" /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-950"><TrendingUp size={17} className="text-blue-600" aria-hidden="true" /> Resumen de ingresos</p>
                      <p className="mt-1 text-sm text-slate-500">Comisiones del mes, operaciones, contratos activos, porcentaje y evolución.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Últimos 12 meses</span>
                  </div>
                  <div className="mt-6 flex h-24 items-end gap-2" aria-label="Gráfico ilustrativo de histórico mensual">
                    {[36, 52, 44, 68, 61, 82, 74, 92, 78, 96, 86, 100].map((height, index) => (
                      <div key={`${height}-${index}`} className="flex-1 rounded-t bg-blue-100" style={{ height: `${height}%` }}>
                        <div className="h-full rounded-t bg-blue-500 opacity-80" />
                      </div>
                    ))}
                  </div>
                </article>
                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <ReceiptText size={23} className="text-blue-600" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-bold">Movimientos mensuales</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Fecha, contrato, base de plataforma, porcentaje y participación de la agencia.</p>
                </article>
                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <Download size={23} className="text-blue-600" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-bold">Autofactura en PDF</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Documento mensual descargable con detalle y total de las comisiones creadas.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-center text-white sm:px-12 sm:py-16">
            <FileCheck2 className="mx-auto text-[#d9ff69]" size={30} aria-hidden="true" />
            <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">La operativa está dentro. Tu agencia entra por aquí.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">Accede con tu cuenta de agencia para dar de alta propietarios, seguir su activación y revisar tus comisiones.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d9ff69] px-6 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-white hover:opacity-100">
                Acceder como agencia <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/" className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 hover:opacity-100">
                Volver a RentalApp
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-500">Las cuentas de agencia se habilitan desde la administración de RentalApp.</p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

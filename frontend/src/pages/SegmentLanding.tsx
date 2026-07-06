import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Banknote,
  Building2,
  ClipboardCheck,
  FileSignature,
  Gauge,
  Home,
  Landmark,
  LineChart,
  MessageSquare,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

type Tone = 'blue' | 'emerald' | 'orange' | 'slate' | 'violet';

const tones: Record<Tone, { accent: string; accentBg: string; soft: string; softBorder: string; band: string }> = {
  blue: { accent: 'text-blue-600', accentBg: 'bg-blue-600', soft: 'bg-blue-50', softBorder: 'border-blue-100', band: 'from-blue-950/85 via-blue-950/60' },
  emerald: { accent: 'text-emerald-600', accentBg: 'bg-emerald-600', soft: 'bg-emerald-50', softBorder: 'border-emerald-100', band: 'from-emerald-950/85 via-emerald-950/60' },
  orange: { accent: 'text-orange-600', accentBg: 'bg-orange-600', soft: 'bg-orange-50', softBorder: 'border-orange-100', band: 'from-orange-950/85 via-orange-950/60' },
  slate: { accent: 'text-slate-600', accentBg: 'bg-slate-700', soft: 'bg-slate-50', softBorder: 'border-slate-200', band: 'from-slate-950/85 via-slate-950/60' },
  violet: { accent: 'text-violet-600', accentBg: 'bg-violet-600', soft: 'bg-violet-50', softBorder: 'border-violet-100', band: 'from-violet-950/85 via-violet-950/60' },
};

type Benefit = { icon: typeof Home; title: string; text: string };
type Step = { title: string; text: string };

type SegmentPage = {
  tone: Tone;
  icon: typeof Home;
  eyebrow: string;
  title: string;
  lead: string;
  cta: string;
  to: string;
  heroImg: string;
  heroAlt: string;
  heroChip: { label: string; value: string };
  storyKicker: string;
  storyTitle: string;
  story: string[];
  storyImg: string;
  storyAlt: string;
  steps: Step[];
  benefits: Benefit[];
  bandImg: string;
  bandClaims: [string, string][];
  finalTitle: string;
  finalText: string;
};

const pages: Record<string, SegmentPage> = {
  inquilinos: {
    tone: 'blue',
    icon: Home,
    eyebrow: 'Para inquilinos',
    title: 'Tu próxima casa, sin perder el piso por el papeleo',
    lead: 'Sube tu documentación una sola vez, conviértela en un perfil Tenant PRO verificado y solicita cualquier vivienda en un clic. La firma, la fianza y los recibos viven en la misma app.',
    cta: 'Buscar vivienda',
    to: '/properties',
    heroImg: '/images/landing/inquilinos-hero.webp',
    heroAlt: 'Pareja joven desembalando cajas en el salón de su nuevo piso de alquiler',
    heroChip: { label: 'Tenant PRO', value: 'Solvencia verificada ✓' },
    storyKicker: 'Así se usa',
    storyTitle: 'De la visita a las llaves en una semana',
    story: [
      'Imagina que te trasladan a Valencia por trabajo. El sábado visitas un piso que te encaja; otros tres candidatos también lo quieren. La diferencia: tu perfil Tenant PRO ya tiene la nómina y el contrato de trabajo verificados, así que el propietario ve solvencia real sin que tú reenvíes un solo PDF.',
      'El domingo envías la solicitud desde el móvil. El martes firmas el contrato digitalmente, pagas la fianza de forma segura y descargas tu copia con evidencias legales. Cuando semanas después gotea el termo, abres una incidencia con fotos y sigues el arreglo — presupuesto, profesional y fecha — sin perseguir a nadie por teléfono.',
    ],
    storyImg: '/images/landing/inquilinos-app.webp',
    storyAlt: 'Pareja sonriente consultando un portátil en su nueva casa durante la mudanza',
    steps: [
      { title: 'Crea tu Tenant PRO', text: 'Sube nómina, contrato o declaración una única vez. Se verifica y sirve para todas tus solicitudes, sin reenviar documentos a desconocidos.' },
      { title: 'Busca y solicita', text: 'Filtra por zona y precio, guarda favoritos y presenta tu candidatura completa con un clic. El propietario recibe un perfil ordenado, no un correo suelto.' },
      { title: 'Firma y vive tranquilo', text: 'Contrato digital con validez legal, fianza y renta por la app, recibos descargables e incidencias con seguimiento hasta que se resuelven.' },
    ],
    benefits: [
      { icon: BadgeCheck, title: 'Destaca entre candidatos', text: 'Un perfil verificado dice más que veinte PDFs. Los propietarios priorizan solicitudes Tenant PRO porque eliminan la incertidumbre.' },
      { icon: ShieldCheck, title: 'Tus datos, protegidos', text: 'Tu documentación se comparte cifrada y solo con quien tú decides, con caducidad automática. Nada de nóminas circulando por WhatsApp.' },
      { icon: Wallet, title: 'Todo el alquiler en un panel', text: 'Contrato, pagos, recibos, incidencias y chat con el propietario en un mismo sitio, desde el primer día hasta la devolución de la fianza.' },
    ],
    bandImg: '/images/landing/inquilinos-hero.webp',
    bandClaims: [
      ['1 sola vez', 'subes tu documentación'],
      ['100% digital', 'solicitud, firma y pagos'],
      ['0 llamadas', 'para resolver una incidencia'],
    ],
    finalTitle: '¿Buscando piso?',
    finalText: 'Crea tu perfil gratis y llega antes que el resto de candidatos.',
  },
  propietarios: {
    tone: 'emerald',
    icon: Building2,
    eyebrow: 'Para propietarios',
    title: 'Alquila tu piso sabiendo a quién le abres la puerta',
    lead: 'Publica tu vivienda, recibe candidatos con solvencia verificada y firma un contrato digital con todas las garantías. Después, la renta se cobra sola y las incidencias se resuelven sin llamadas.',
    cta: 'Publicar propiedad',
    to: '/register?role=landlord',
    heroImg: '/images/landing/propietarios-hero.webp',
    heroAlt: 'Propietario entregando las llaves de la vivienda a una pareja de inquilinos en el salón',
    heroChip: { label: 'Renta de marzo', value: 'Cobrada · recibo emitido' },
    storyKicker: 'Así se usa',
    storyTitle: 'Un segundo piso sin segundas preocupaciones',
    story: [
      'Piensa en un propietario con un piso heredado en Zaragoza. Lo publica en RentalApp con fotos y precio orientado por zona. En una semana tiene doce solicitudes; cuatro llegan con Tenant PRO, así que compara solvencia real — ingresos verificados, sin papeles que pedir ni verificar a mano — y elige con datos, no con intuición.',
      'El contrato se genera con cláusulas adaptadas a la LAU, se firma digitalmente y queda archivado con evidencias. La renta se cobra cada mes de forma automática con su recibo. Cuando el inquilino reporta una avería de calefacción, un profesional de la plataforma envía presupuesto; el propietario lo aprueba desde el móvil y ve el trabajo cerrado con parte y factura.',
    ],
    storyImg: '/images/landing/propietarios-edificio.webp',
    storyAlt: 'Fachadas de edificios residenciales clásicos con balcones en una ciudad española',
    steps: [
      { title: 'Publica con criterio', text: 'Sube fotos, describe la vivienda (o deja que la IA lo redacte) y fija el precio con contexto de zona, incluidas las reglas de zonas tensionadas.' },
      { title: 'Elige con datos', text: 'Compara candidatos con perfil Tenant PRO: solvencia verificada, historial y documentación completa. Sin persecuciones ni fotocopias.' },
      { title: 'Firma y delega la gestión', text: 'Contrato digital con evidencias legales, cobro automático de renta, recibos, incidencias canalizadas a profesionales y todo el histórico en tu panel.' },
    ],
    benefits: [
      { icon: BadgeCheck, title: 'Menos riesgo de impago', text: 'La solvencia se verifica antes de firmar. Ves ingresos y estabilidad reales de cada candidato, no promesas.' },
      { icon: FileSignature, title: 'Contrato blindado', text: 'Plantillas al día con la normativa, firma electrónica con validez legal y evidencias archivadas por si algún día las necesitas.' },
      { icon: Banknote, title: 'Cobros en piloto automático', text: 'Renta mensual domiciliada con recibo automático. Si algo falla, lo ves al momento en tu panel, no a fin de mes.' },
      { icon: Wrench, title: 'Averías sin llamadas', text: 'Cada incidencia entra con fotos, va a un profesional verificado y tú solo apruebas el presupuesto. El resto queda registrado.' },
    ],
    bandImg: '/images/landing/propietarios-edificio.webp',
    bandClaims: [
      ['Solvencia', 'verificada antes de firmar'],
      ['LAU', 'contratos siempre al día'],
      ['24/7', 'visibilidad de pagos e incidencias'],
    ],
    finalTitle: '¿Tienes un piso vacío?',
    finalText: 'Publícalo hoy y recibe candidatos verificados esta misma semana.',
  },
  profesionales: {
    tone: 'orange',
    icon: Wrench,
    eyebrow: 'Para profesionales',
    title: 'Trabajos de mantenimiento sin perseguir clientes ni facturas',
    lead: 'Recibe averías con fotos y dirección, presupuesta desde el móvil y cobra con todo aprobado por escrito. Tu agenda se llena con trabajo real, no con visitas para mirar.',
    cta: 'Entrar como pro',
    to: '/register?role=pro',
    heroImg: '/images/landing/profesionales-hero.webp',
    heroAlt: 'Fontanero reparando el sifón bajo el fregadero de una cocina',
    heroChip: { label: 'Presupuesto #2114', value: 'Aprobado · 180 €' },
    storyKicker: 'Así se usa',
    storyTitle: 'Del aviso al cobro, todo por escrito',
    story: [
      'Un fontanero en Madrid recibe un ticket: fuga bajo el fregadero, con fotos, dirección y disponibilidad del inquilino. Antes de moverse ya sabe qué herramienta llevar y qué pieza puede hacer falta. Envía el presupuesto desde el móvil y el propietario lo aprueba en minutos, no tras una semana de llamadas.',
      'En la obra aparece un latiguillo podrido que no estaba en el parte. Lo añade como extra con foto, el propietario lo aprueba en la app y nadie discute el precio después. Termina, sube el parte de trabajo y la facturación queda registrada — exportable a CSV para su gestoría a fin de mes.',
    ],
    storyImg: '/images/landing/profesionales-trabajo.webp',
    storyAlt: 'Electricista instalando una lámpara de techo junto a una ventana',
    steps: [
      { title: 'Crea tu perfil profesional', text: 'Alta con tus especialidades y zona de trabajo. Los tickets te llegan filtrados: solo averías de lo tuyo, donde tú trabajas.' },
      { title: 'Presupuesta con contexto', text: 'Cada aviso llega con fotos y descripción. Envías presupuesto cerrado y los extras se aprueban por escrito antes de ejecutarlos.' },
      { title: 'Ejecuta y cobra', text: 'Parte de trabajo, aprobación del cliente y facturación trazable. Tu histórico y tus números, exportables cuando los necesites.' },
    ],
    benefits: [
      { icon: ClipboardCheck, title: 'Avisos con contexto', text: 'Fotos, dirección y descripción antes de moverte. Menos visitas de diagnóstico, más trabajos cerrados por día.' },
      { icon: MessageSquare, title: 'Extras sin discusiones', text: 'Todo cambio sobre el presupuesto se aprueba por escrito en la app. Se acabó el "eso no me lo dijiste".' },
      { icon: LineChart, title: 'Facturación ordenada', text: 'Cada trabajo queda registrado con su importe y su estado. Export CSV listo para tu gestoría.' },
    ],
    bandImg: '/images/landing/profesionales-hero.webp',
    bandClaims: [
      ['Con fotos', 'cada aviso llega documentado'],
      ['Por escrito', 'presupuestos y extras aprobados'],
      ['CSV', 'tu facturación, exportable'],
    ],
    finalTitle: '¿Eres fontanero, electricista, cerrajero…?',
    finalText: 'Date de alta y empieza a recibir avisos de tu especialidad en tu zona.',
  },
  agencias: {
    tone: 'slate',
    icon: ShieldCheck,
    eyebrow: 'Programa de agencias',
    title: 'Tu cartera de alquiler, operada desde un solo panel',
    lead: 'Da de alta a tus propietarios, deja que RentalApp opere la parte dura — firma, cobros, incidencias — y genera comisiones recurrentes por cada contrato captado o gestionado.',
    cta: 'Solicitar acceso agencia',
    to: '/login',
    heroImg: '/images/landing/agencias-hero.webp',
    heroAlt: 'Agente inmobiliario enseñando una vivienda a una pareja de clientes',
    heroChip: { label: 'Comisión abril', value: '12 contratos activos' },
    storyKicker: 'Así se usa',
    storyTitle: 'Captas el cliente, la plataforma opera el alquiler',
    story: [
      'Una agencia de Bilbao lleva años gestionando alquileres con hojas de cálculo y llamadas. Con el programa de agencias, invita a sus propietarios a RentalApp: cada uno queda atribuido a la agencia, con su funnel visible — desde el alta hasta el contrato firmado.',
      'Por cada contrato captado, la agencia cobra comisión recurrente por tramos sobre la renta gestionada. La operación diaria — firma digital, cobro de rentas, recibos, incidencias con profesionales — la hace la plataforma. La agencia ve todo en su panel: cartera, contratos, cobros y una factura PDF mensual con sus comisiones.',
    ],
    storyImg: '/images/landing/agencias-firma.webp',
    storyAlt: 'Primer plano de una persona firmando un contrato sobre la mesa',
    steps: [
      { title: 'Activa tu agencia', text: 'RentalApp provisiona tu cuenta con acceso al panel de agencia: cartera, funnel de captación y comisiones.' },
      { title: 'Invita a tus propietarios', text: 'Cada propietario que invitas queda atribuido a tu agencia, con sus propiedades y contratos vinculados a tu cartera.' },
      { title: 'Cobra comisiones recurrentes', text: 'Comisión por tramos sobre los contratos captados o gestionados, con resumen mensual y factura PDF descargable.' },
    ],
    benefits: [
      { icon: Users, title: 'Cartera centralizada', text: 'Todos tus propietarios, propiedades y contratos en un panel, con el estado de cada operación a la vista.' },
      { icon: Gauge, title: 'Funnel de captación', text: 'Sigue cada cliente desde la invitación hasta la firma. Sabes qué propietario está parado y por qué.' },
      { icon: Banknote, title: 'Ingresos recurrentes', text: 'No cobras una vez por operación: cobras cada mes por la renta gestionada, mientras el contrato siga vivo.' },
    ],
    bandImg: '/images/landing/agencias-hero.webp',
    bandClaims: [
      ['Recurrente', 'comisión mensual por contrato'],
      ['Por tramos', 'más cartera, mejor porcentaje'],
      ['PDF', 'factura de comisiones mensual'],
    ],
    finalTitle: '¿Gestionas alquileres?',
    finalText: 'Solicita acceso al programa de agencias y convierte tu cartera en ingresos recurrentes.',
  },
  compliance: {
    tone: 'violet',
    icon: Landmark,
    eyebrow: 'Instituciones y compliance',
    title: 'La foto completa del alquiler en tu territorio',
    lead: 'Zonas tensionadas, contratos con evidencias, políticas aceptadas y métricas agregadas: los datos que necesitas para supervisar el mercado del alquiler, exportables y auditables.',
    cta: 'Ver compliance',
    to: '/login',
    heroImg: '/images/landing/compliance-hero.webp',
    heroAlt: 'Vista aérea del Eixample de Barcelona con su trama urbana de manzanas residenciales',
    heroChip: { label: 'Zona tensionada', value: 'Tope de renta aplicado ✓' },
    storyKicker: 'Así se usa',
    storyTitle: 'Supervisión con evidencias, no con muestreos',
    story: [
      'Un equipo de vivienda necesita verificar que los contratos firmados en una zona tensionada respetan los topes de renta. En lugar de pedir documentación caso a caso, consulta el dashboard: contratos de la zona, renta aplicada frente al índice, y las evidencias de firma y aceptación de políticas de cada expediente.',
      'Para el informe trimestral exporta los datos agregados en CSV y las evidencias en PDF, con trazabilidad de cada evento — quién firmó qué, cuándo y bajo qué versión de cláusulas. La supervisión pasa de muestreos manuales a una vista continua y auditable del mercado.',
    ],
    storyImg: '/images/landing/compliance-ciudad.webp',
    storyAlt: 'Calle de edificios históricos con balcones en el centro de una ciudad andaluza',
    steps: [
      { title: 'Configura zonas y reglas', text: 'Define zonas tensionadas y los índices aplicables. La plataforma valida cada contrato nuevo contra esas reglas.' },
      { title: 'Audita en continuo', text: 'Dashboard de riesgos con contratos, rentas, evidencias de firma y políticas aceptadas, siempre al día.' },
      { title: 'Exporta evidencias', text: 'CSV y PDF auditables con trazabilidad completa de eventos, listos para expediente o informe.' },
    ],
    benefits: [
      { icon: Gauge, title: 'Vista continua del mercado', text: 'Métricas agregadas de contratos y rentas por zona, sin esperar a requerir documentación.' },
      { icon: ShieldCheck, title: 'Evidencias sólidas', text: 'Cada contrato guarda firma electrónica, versión de cláusulas y aceptaciones con sello temporal.' },
      { icon: ClipboardCheck, title: 'Exportación auditable', text: 'CSV y PDF con trazabilidad de eventos, pensados para expedientes administrativos y auditorías.' },
    ],
    bandImg: '/images/landing/compliance-hero.webp',
    bandClaims: [
      ['Por zona', 'contratos frente a índices de renta'],
      ['Trazable', 'cada evento, con sello temporal'],
      ['CSV / PDF', 'evidencias listas para expediente'],
    ],
    finalTitle: '¿Supervisas el mercado del alquiler?',
    finalText: 'Solicita una demo del panel de compliance para tu organismo.',
  },
};

export default function SegmentLanding() {
  const { segment = '' } = useParams();
  const page = pages[segment];

  useEffect(() => {
    if (page) document.title = `${page.title} · RentalApp`;
    return () => {
      document.title = 'RentalApp';
    };
  }, [page]);

  if (!page) return <Navigate to="/" replace />;
  const Icon = page.icon;
  const tone = tones[page.tone];

  return (
    <main className="bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-widest ${tone.accent}`}>
              <Icon className="h-5 w-5" />
              {page.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">{page.title}</h1>
            <p className="mt-5 max-w-xl text-lg text-gray-600">{page.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={page.to} className="rounded-md bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                {page.cta}
              </Link>
              <Link to="/" className="rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                Volver al inicio
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={page.heroImg}
              alt={page.heroAlt}
              width={800}
              height={533}
              className="aspect-[3/2] w-full rounded-xl object-cover shadow-lg"
            />
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-md">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone.soft}`}>
                <BadgeCheck className={`h-5 w-5 ${tone.accent}`} />
              </span>
              <div>
                <p className="text-xs font-medium text-gray-500">{page.heroChip.label}</p>
                <p className="text-sm font-semibold text-gray-950">{page.heroChip.value}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Historia */}
      <section className={`border-y ${tone.softBorder} ${tone.soft} py-14`}>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <img
            src={page.storyImg}
            alt={page.storyAlt}
            width={600}
            height={450}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-xl object-cover shadow-md"
          />
          <div>
            <p className={`text-sm font-semibold uppercase tracking-widest ${tone.accent}`}>{page.storyKicker}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">{page.storyTitle}</h2>
            {page.story.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-4 text-gray-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Cómo funciona</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {page.steps.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-gray-200 p-6">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${tone.accentBg}`}>
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold text-gray-950">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Banda con imagen */}
      <section className="relative overflow-hidden">
        <img src={page.bandImg} alt="" width={1400} height={500} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className={`relative bg-gradient-to-r ${tone.band} to-gray-950/40 py-14`}>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            {page.bandClaims.map(([value, label]) => (
              <div key={label}>
                <p className="text-3xl font-bold text-white">{value}</p>
                <p className="mt-1 text-sm text-white/80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Lo que te llevas</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.benefits.map(({ icon: BenefitIcon, title, text }) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-white p-6">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone.soft}`}>
                <BenefitIcon className={`h-5 w-5 ${tone.accent}`} />
              </span>
              <h3 className="mt-4 font-semibold text-gray-950">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-gray-100 bg-gray-50 py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-950">{page.finalTitle}</h2>
            <p className="mt-2 text-gray-600">{page.finalText}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={page.to} className="rounded-md bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              {page.cta}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

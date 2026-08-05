import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  FileSignature,
  Home,
  Landmark,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react';

type CountUpProps = {
  value: number;
  suffix?: string;
  label: string;
  delay?: number;
};

function CountUp({ value, suffix = '', label, delay = 0 }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.55 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const timeout = window.setTimeout(() => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / 1450, 1);
        setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 4))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [delay, value, visible]);

  return (
    <div className="ra-stat" ref={ref}>
      <strong aria-label={`${value}${suffix} ${label}`}>
        <span aria-hidden="true">{display}{suffix}</span>
      </strong>
      <span>{label}</span>
    </div>
  );
}

const profiles = [
  {
    id: 'inquilinos',
    label: 'Inquilinos',
    eyebrow: 'Encuentra y demuestra',
    title: 'Tu próximo hogar, sin volver a enviar los mismos papeles.',
    text: 'Busca vivienda, crea tu perfil Tenant PRO y presenta tu solvencia de forma clara y segura.',
    image: '/images/landing/inquilinos-hero.webp',
    alt: 'Pareja joven instalándose en su nuevo hogar',
    to: '/info/inquilinos',
    action: 'Buscar vivienda',
    icon: Home,
  },
  {
    id: 'propietarios',
    label: 'Propietarios',
    eyebrow: 'Publica y protege',
    title: 'Más control sobre tu alquiler, sin convertirlo en otro trabajo.',
    text: 'Compara candidatos, firma el contrato y automatiza los cobros desde un único panel.',
    image: '/images/landing/propietarios-hero.webp',
    alt: 'Propietario entregando las llaves de una vivienda',
    to: '/info/propietarios',
    action: 'Publicar propiedad',
    icon: Building2,
  },
  {
    id: 'profesionales',
    label: 'Profesionales',
    eyebrow: 'Resuelve y cobra',
    title: 'Trabajos claros, presupuestos aprobados y cobros trazables.',
    text: 'Gestiona incidencias de mantenimiento con toda la información, el historial y los pagos en orden.',
    image: '/images/landing/profesionales-hero.webp',
    alt: 'Profesional de mantenimiento trabajando en una vivienda',
    to: '/info/profesionales',
    action: 'Entrar como profesional',
    icon: Wrench,
  },
  {
    id: 'agencias',
    label: 'Agencias',
    eyebrow: 'Opera y escala',
    title: 'Una cartera completa sin hojas sueltas ni procesos duplicados.',
    text: 'Invita a clientes, delega permisos y supervisa contratos, cobros e incidencias desde un solo lugar.',
    image: '/images/landing/agencias-hero.webp',
    alt: 'Equipo de una agencia inmobiliaria trabajando',
    to: '/info/agencias',
    action: 'Ver programa de agencias',
    icon: ShieldCheck,
  },
  {
    id: 'compliance',
    label: 'Instituciones',
    eyebrow: 'Audita y comprende',
    title: 'Datos agregados y cumplimiento para tomar mejores decisiones.',
    text: 'Controla zonas tensionadas, indicadores y exportaciones auditables con una visión completa.',
    image: '/images/landing/compliance-hero.webp',
    alt: 'Vista aérea de una ciudad con edificios residenciales',
    to: '/info/compliance',
    action: 'Ver compliance',
    icon: Landmark,
  },
];

const benefits = [
  'Contratos actualizados a la LAU',
  'Firma electrónica con evidencias',
  'Pagos y recibos automáticos',
  'Solvencia verificada con Tenant PRO',
];

export default function LandingPage() {
  const [activeProfile, setActiveProfile] = useState(profiles[0]);

  useEffect(() => {
    document.title = 'RentalApp — El alquiler completo en una sola plataforma';
    return () => {
      document.title = 'RentalApp';
    };
  }, []);

  return (
    <main className="ra-landing">
      <section className="ra-hero" id="inicio">
        <div className="ra-hero-grid" aria-hidden="true" />
        <div className="ra-hero-orbit" aria-hidden="true" />
        <div className="ra-hero-copy">
          <p className="ra-eyebrow ra-eyebrow-light">La infraestructura del alquiler</p>
          <h1>Alquilar debería <span>sentirse así de fácil.</span></h1>
          <p className="ra-hero-intro">
            Publica, verifica, firma, cobra y resuelve incidencias desde una sola plataforma.
            Todo claro, conectado y siempre a mano.
          </p>
          <div className="ra-hero-actions">
            <Link className="ra-button ra-button-lime" to="/info/inquilinos">
              Buscar vivienda <ArrowRight size={17} />
            </Link>
            <Link className="ra-button ra-button-ghost" to="/info/propietarios">
              Publicar propiedad
            </Link>
          </div>
          <div className="ra-hero-proof">
            <div className="ra-proof-avatars" aria-hidden="true">
              <span>A</span><span>M</span><span>J</span>
            </div>
            <p>Un flujo compartido para todas las personas que hacen posible un alquiler.</p>
          </div>
        </div>

        <div className="ra-hero-scene">
          <div className="ra-hero-photo-wrap">
            <img
              className="ra-hero-photo"
              src="/images/landing/inquilinos-hero.webp"
              alt="Pareja instalándose en su nueva vivienda de alquiler"
            />
          </div>
          <div className="ra-float-card ra-contract-card">
            <span className="ra-float-icon"><Check size={18} /></span>
            <div><small>Estado del contrato</small><strong>Firmado por ambas partes</strong></div>
          </div>
          <div className="ra-float-card ra-payment-card">
            <div className="ra-payment-head"><small>Próximo cobro</small><span>Protegido</span></div>
            <strong>890,00 €</strong>
            <div className="ra-payment-track"><span /></div>
            <small>Programado para el 1 de agosto</small>
          </div>
          <div className="ra-mini-badge"><span>TP</span> Perfil verificado</div>
        </div>
      </section>

      <section className="ra-trust-strip" aria-label="Ventajas principales">
        {benefits.map((benefit) => (
          <div key={benefit}><BadgeCheck size={17} />{benefit}</div>
        ))}
      </section>

      <section className="ra-stats-section" aria-label="Impacto de RentalApp">
        <div className="ra-section-heading">
          <p className="ra-eyebrow">Todo conectado</p>
          <h2>Una app. Todo el ciclo del alquiler.</h2>
        </div>
        <div className="ra-stats-grid">
          <CountUp value={100} suffix="%" label="digital de inicio a fin" />
          <CountUp value={5} label="perfiles, un mismo sistema" delay={120} />
          <CountUp value={1} label="historial compartido y auditable" delay={240} />
        </div>
      </section>

      <section className="ra-product-section" id="producto">
        <div className="ra-section-intro">
          <p className="ra-eyebrow">El producto</p>
          <h2>Menos gestión. Más tranquilidad en cada paso.</h2>
          <p>RentalApp convierte un proceso fragmentado en un recorrido claro, trazable y compartido.</p>
        </div>
        <div className="ra-bento-grid">
          <article className="ra-bento-card ra-bento-contract">
            <div>
              <span className="ra-feature-index">01</span>
              <h3>Un contrato que no empieza en Word.</h3>
              <p>Plantillas actualizadas, firma electrónica y evidencias archivadas dentro del mismo flujo.</p>
            </div>
            <div className="ra-contract-sheet" aria-hidden="true">
              <div className="ra-sheet-top"><FileSignature size={20} /><span>Listo para firmar</span></div>
              <i /><i /><i />
              <div className="ra-signatures"><span>Propietario ✓</span><span>Inquilino ✓</span></div>
            </div>
          </article>
          <article className="ra-bento-card ra-bento-verify">
            <span className="ra-feature-index">02</span>
            <div className="ra-verify-orbit" aria-hidden="true"><span>✓</span><i /><i /><i /></div>
            <h3>Solvencia que se verifica una vez.</h3>
            <p>Tenant PRO transforma documentación dispersa en un perfil claro y reutilizable.</p>
          </article>
          <article className="ra-bento-card ra-bento-payments">
            <span className="ra-feature-index">03</span>
            <h3>Cobros que se entienden de un vistazo.</h3>
            <p>Renta, fianza, recibos y estados de pago ordenados para ambas partes.</p>
            <div className="ra-payment-list" aria-hidden="true">
              <span><Wallet size={18} /> Julio <strong>Pagado</strong></span>
              <span><Wallet size={18} /> Agosto <strong>Programado</strong></span>
            </div>
          </article>
        </div>
      </section>

      <section className="ra-profiles-section" id="perfiles">
        <div className="ra-section-intro">
          <p className="ra-eyebrow">Hecha para cada parte</p>
          <h2>Una plataforma. Tu propio recorrido.</h2>
        </div>
        <div className="ra-profile-tabs" role="tablist" aria-label="Perfiles de RentalApp">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={activeProfile.id === profile.id ? 'is-active' : ''}
              onClick={() => setActiveProfile(profile)}
              role="tab"
              aria-selected={activeProfile.id === profile.id}
            >
              <profile.icon size={17} />{profile.label}
            </button>
          ))}
        </div>
        <div className="ra-profile-stage">
          <div className="ra-profile-copy">
            <p className="ra-eyebrow">{activeProfile.eyebrow}</p>
            <h3>{activeProfile.title}</h3>
            <p>{activeProfile.text}</p>
            <Link to={activeProfile.to} className="ra-text-link">
              {activeProfile.action} <ArrowRight size={17} />
            </Link>
          </div>
          <div className="ra-profile-photo">
            <img src={activeProfile.image} alt={activeProfile.alt} />
          </div>
        </div>
      </section>

      <section className="ra-final-cta" id="como-funciona">
        <div>
          <p className="ra-eyebrow ra-eyebrow-light">Empieza hoy</p>
          <h2>Tu próximo alquiler puede ser mucho más sencillo.</h2>
          <p>Crea tu cuenta gratis y deja que cada paso tenga su sitio.</p>
        </div>
        <div className="ra-final-actions">
          <Link to="/register" className="ra-button ra-button-lime">Crear cuenta <ArrowRight size={17} /></Link>
          <Link to="/properties" className="ra-button ra-button-ghost">Ver viviendas</Link>
        </div>
      </section>
    </main>
  );
}

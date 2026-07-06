import LegalLayout, { LEGAL_CONTACT_EMAIL, LEGAL_OWNER } from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout
      title="Términos y condiciones de uso"
      updated="6 de julio de 2026"
      intro={`Estos términos regulan el uso de la plataforma app.rentalapp.es, operada por ${LEGAL_OWNER}. Al crear una cuenta aceptas estas condiciones; léelas antes de usar el servicio.`}
      sections={[
        {
          title: 'Qué es RentalApp',
          body: (
            <p>
              RentalApp es una plataforma de gestión integral del alquiler de viviendas: publicación de inmuebles,
              solicitudes de candidatos con solvencia verificada, generación y firma electrónica de contratos, cobro de
              rentas y fianzas, gestión de incidencias con profesionales verificados y paneles para agencias e
              instituciones. RentalApp no es parte del contrato de arrendamiento, que se celebra entre arrendador y
              arrendatario.
            </p>
          ),
        },
        {
          title: 'Registro y cuentas',
          body: (
            <ul>
              <li>Debes ser mayor de edad y facilitar información veraz y actualizada.</li>
              <li>Cada cuenta es personal e intransferible; eres responsable de custodiar tus credenciales.</li>
              <li>Los perfiles verificados (Tenant PRO, profesionales, agencias) requieren documentación adicional que debe ser auténtica y estar vigente.</li>
              <li>Podemos suspender cuentas que incumplan estos términos, publiquen información falsa o hagan un uso fraudulento del servicio.</li>
            </ul>
          ),
        },
        {
          title: 'Anuncios y solicitudes',
          body: (
            <ul>
              <li>El propietario o agencia es responsable de la veracidad del anuncio y de tener título suficiente para alquilar el inmueble.</li>
              <li>Los anuncios deben cumplir la normativa aplicable, incluidas las reglas de zonas de mercado residencial tensionado cuando correspondan.</li>
              <li>Las solicitudes de los candidatos y la documentación compartida solo pueden usarse para evaluar el alquiler en cuestión.</li>
            </ul>
          ),
        },
        {
          title: 'Contratos y firma electrónica',
          body: (
            <p>
              Los contratos generados en la plataforma utilizan plantillas adaptadas a la legislación española de
              arrendamientos (LAU). La firma se realiza mediante un proveedor de firma electrónica que genera evidencias
              con validez legal. Las partes son responsables de revisar el contrato antes de firmarlo; RentalApp no
              presta asesoramiento jurídico.
            </p>
          ),
        },
        {
          title: 'Pagos, fianzas y comisiones',
          body: (
            <ul>
              <li>Los pagos se procesan a través de proveedores de pago autorizados; RentalApp no custodia directamente fondos de los usuarios.</li>
              <li>El arrendador sigue siendo responsable de depositar la fianza en el organismo autonómico correspondiente cuando la ley lo exija.</li>
              <li>Las tarifas y comisiones aplicables a cada servicio se muestran antes de contratarlo.</li>
            </ul>
          ),
        },
        {
          title: 'Incidencias y profesionales',
          body: (
            <p>
              Los profesionales de mantenimiento son terceros independientes que prestan sus servicios bajo su propia
              responsabilidad. RentalApp verifica su alta en la plataforma y canaliza presupuestos, aprobaciones y pagos,
              pero no es parte del contrato de obra o servicio entre el profesional y quien lo contrata.
            </p>
          ),
        },
        {
          title: 'Responsabilidad',
          body: (
            <p>
              Prestamos el servicio con diligencia profesional, pero no garantizamos la disponibilidad ininterrumpida de
              la plataforma ni respondemos de los incumplimientos contractuales entre usuarios (impagos, daños en el
              inmueble, defectos en los trabajos de profesionales). Nada en estos términos limita derechos que la ley
              reconozca a los consumidores.
            </p>
          ),
        },
        {
          title: 'Propiedad intelectual',
          body: (
            <p>
              La plataforma, su código, diseño y contenidos son titularidad de {LEGAL_OWNER} o de sus licenciantes. El
              contenido que subes (fotos, descripciones, documentos) sigue siendo tuyo; nos concedes una licencia
              limitada para mostrarlo y procesarlo con el único fin de prestar el servicio.
            </p>
          ),
        },
        {
          title: 'Ley aplicable y jurisdicción',
          body: (
            <p>
              Estos términos se rigen por la legislación española. Para cualquier controversia serán competentes los
              juzgados y tribunales que correspondan conforme a la normativa de consumidores; para dudas o reclamaciones
              previas puedes escribir a {LEGAL_CONTACT_EMAIL}.
            </p>
          ),
        },
      ]}
    />
  );
}

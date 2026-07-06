import LegalLayout, { LEGAL_CONTACT_EMAIL, LEGAL_OWNER } from './LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de privacidad"
      updated="6 de julio de 2026"
      intro={`En ${LEGAL_OWNER} tratamos tus datos personales para que puedas alquilar, publicar o gestionar viviendas con todas las garantías. Esta política explica qué datos recogemos, para qué los usamos y qué derechos tienes conforme al Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD.`}
      sections={[
        {
          title: 'Responsable del tratamiento',
          body: (
            <p>
              {LEGAL_OWNER}, titular de la plataforma app.rentalapp.es. Contacto para cuestiones de privacidad:{' '}
              {LEGAL_CONTACT_EMAIL}.
            </p>
          ),
        },
        {
          title: 'Datos que tratamos',
          body: (
            <ul>
              <li>Datos de cuenta: nombre, email, teléfono y rol (inquilino, propietario, profesional, agencia o institución).</li>
              <li>
                Datos de verificación (Tenant PRO y KYC): documentación de identidad y de solvencia (nóminas, contratos de
                trabajo, declaraciones) que subes voluntariamente para verificar tu perfil.
              </li>
              <li>Datos contractuales: contratos de arrendamiento, firmas electrónicas y sus evidencias legales.</li>
              <li>Datos de pago: rentas, fianzas y presupuestos procesados a través de proveedores de pago; no almacenamos los números completos de tu tarjeta.</li>
              <li>Datos de uso: incidencias, mensajes dentro de la plataforma y registros técnicos necesarios para la seguridad del servicio.</li>
            </ul>
          ),
        },
        {
          title: 'Finalidades y base legal',
          body: (
            <ul>
              <li>Prestar el servicio (gestión de cuenta, anuncios, solicitudes, contratos, pagos e incidencias) — ejecución de contrato.</li>
              <li>Verificar identidad y solvencia cuando lo solicitas — ejecución de contrato y consentimiento.</li>
              <li>Cumplir obligaciones legales (fiscales, prevención de fraude, requerimientos de autoridades) — obligación legal.</li>
              <li>Mejorar la seguridad y el funcionamiento de la plataforma — interés legítimo.</li>
              <li>Enviarte comunicaciones sobre tu actividad (solicitudes, firmas, pagos, incidencias) — ejecución de contrato.</li>
            </ul>
          ),
        },
        {
          title: 'Destinatarios',
          body: (
            <ul>
              <li>Proveedores de pago (Stripe) para procesar rentas, fianzas y verificación de identidad.</li>
              <li>Proveedores de firma electrónica cualificada para la firma de contratos y sus evidencias.</li>
              <li>Proveedores de alojamiento e infraestructura dentro del Espacio Económico Europeo o con garantías adecuadas.</li>
              <li>
                Las otras partes de tu alquiler: si eres candidato, el propietario o agencia ve tu perfil y la documentación
                que decidas compartir; si eres propietario, los candidatos ven los datos del anuncio.
              </li>
              <li>Administraciones públicas cuando exista obligación legal.</li>
            </ul>
          ),
        },
        {
          title: 'Conservación',
          body: (
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Los contratos, firmas y justificantes de pago se
              conservan durante los plazos de prescripción legal aplicables (con carácter general, hasta 6 años para
              documentación mercantil). La documentación de verificación caduca y se elimina conforme a los plazos
              indicados al subirla.
            </p>
          ),
        },
        {
          title: 'Tus derechos',
          body: (
            <p>
              Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
              escribiendo a {LEGAL_CONTACT_EMAIL}. También puedes reclamar ante la Agencia Española de Protección de
              Datos (aepd.es) si consideras que no hemos tratado tus datos correctamente.
            </p>
          ),
        },
        {
          title: 'Seguridad',
          body: (
            <p>
              Aplicamos medidas técnicas y organizativas apropiadas: cifrado en tránsito, cifrado de la documentación
              sensible en reposo, control de acceso por roles y registro de actividad. Ningún sistema es infalible; si
              detectamos una brecha que afecte a tus datos, te lo notificaremos conforme al RGPD.
            </p>
          ),
        },
      ]}
    />
  );
}

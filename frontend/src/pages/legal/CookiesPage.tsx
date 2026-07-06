import LegalLayout, { LEGAL_CONTACT_EMAIL } from './LegalLayout';

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Política de cookies"
      updated="6 de julio de 2026"
      intro="RentalApp no utiliza cookies publicitarias ni de analítica de terceros. Solo empleamos almacenamiento técnico imprescindible para que la plataforma funcione, por lo que no necesitas configurar nada."
      sections={[
        {
          title: 'Qué almacenamiento utilizamos',
          body: (
            <ul>
              <li>
                <strong>Sesión</strong> (localStorage: token, user): mantiene tu sesión iniciada de forma segura. Se
                elimina al cerrar sesión.
              </li>
              <li>
                <strong>Preferencias</strong> (localStorage: theme): recuerda si prefieres el tema claro u oscuro.
              </li>
              <li>
                <strong>Aceptación de políticas</strong> (localStorage: policy_version_*): registra qué versión de la
                política de privacidad y de los términos has aceptado, para no volver a pedírtelo.
              </li>
            </ul>
          ),
        },
        {
          title: 'Cookies de terceros en flujos concretos',
          body: (
            <p>
              Cuando realizas un pago o una verificación de identidad, nuestro proveedor de pagos (Stripe) puede
              establecer cookies técnicas propias necesarias para procesar la operación de forma segura y prevenir el
              fraude. Estas cookies solo se activan al usar esos flujos y se rigen por la política de privacidad de
              Stripe.
            </p>
          ),
        },
        {
          title: 'Lo que no hacemos',
          body: (
            <ul>
              <li>No usamos cookies de publicidad ni de seguimiento entre sitios.</li>
              <li>No usamos herramientas de analítica de terceros (Google Analytics u otras).</li>
              <li>No compartimos tu actividad de navegación con redes sociales ni plataformas publicitarias.</li>
            </ul>
          ),
        },
        {
          title: 'Cómo gestionar el almacenamiento',
          body: (
            <p>
              Puedes borrar el almacenamiento local desde la configuración de tu navegador (borrar datos de sitios). Ten
              en cuenta que al hacerlo se cerrará tu sesión. Si en el futuro incorporamos cookies que requieran
              consentimiento, actualizaremos esta política y te lo pediremos expresamente. Cualquier duda:{' '}
              {LEGAL_CONTACT_EMAIL}.
            </p>
          ),
        },
      ]}
    />
  );
}

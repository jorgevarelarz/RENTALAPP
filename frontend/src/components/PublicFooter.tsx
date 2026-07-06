import { Link } from 'react-router-dom';

const columns: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Perfiles',
    links: [
      { label: 'Inquilinos', to: '/info/inquilinos' },
      { label: 'Propietarios', to: '/info/propietarios' },
      { label: 'Profesionales', to: '/info/profesionales' },
      { label: 'Agencias', to: '/info/agencias' },
      { label: 'Instituciones', to: '/info/compliance' },
    ],
  },
  {
    title: 'Plataforma',
    links: [
      { label: 'Ver viviendas', to: '/properties' },
      { label: 'Crear cuenta', to: '/register' },
      { label: 'Entrar', to: '/login' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacidad', to: '/legal/privacidad' },
      { label: 'Términos de uso', to: '/legal/terminos' },
      { label: 'Cookies', to: '/legal/cookies' },
    ],
  },
];

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div>
            <p className="text-lg font-bold text-gray-950">RentalApp</p>
            <p className="mt-3 max-w-xs text-sm text-gray-600">
              El alquiler sin fricción: contratos digitales, solvencia verificada, pagos protegidos e incidencias
              resueltas en una sola app.
            </p>
          </div>
          {columns.map(({ title, links }) => (
            <div key={title}>
              <p className="text-sm font-semibold uppercase tracking-wider text-gray-950">{title}</p>
              <ul className="mt-4 space-y-3">
                {links.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className="text-sm text-gray-600 hover:text-gray-950 hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-gray-200 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RentalApp. Todos los derechos reservados.</p>
          <p>Hecho en España · app.rentalapp.es</p>
        </div>
      </div>
    </footer>
  );
}

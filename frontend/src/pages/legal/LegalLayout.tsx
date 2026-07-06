import { ReactNode, useEffect } from 'react';

// Datos del titular de la plataforma. Completar con la razón social,
// NIF y domicilio registrales antes de campañas públicas de captación.
export const LEGAL_OWNER = 'RentalApp';
export const LEGAL_CONTACT_EMAIL = 'info@rentalapp.es';

type Section = { title: string; body: ReactNode };

export default function LegalLayout({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
}) {
  useEffect(() => {
    document.title = `${title} · RentalApp`;
    return () => {
      document.title = 'RentalApp';
    };
  }, [title]);

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Legal</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Última actualización: {updated}</p>
        <p className="mt-6 text-gray-700">{intro}</p>
        {sections.map(({ title: sectionTitle, body }, index) => (
          <section key={sectionTitle} className="mt-10">
            <h2 className="text-xl font-semibold text-gray-950">
              {index + 1}. {sectionTitle}
            </h2>
            <div className="mt-3 space-y-3 text-gray-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">{body}</div>
          </section>
        ))}
        <p className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          ¿Dudas sobre este documento? Escríbenos a{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-indigo-600 hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

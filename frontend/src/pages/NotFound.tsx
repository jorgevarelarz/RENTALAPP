import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
    <p className="text-sm font-semibold tracking-widest text-indigo-600">ERROR 404</p>
    <h1 className="mt-3 text-3xl font-bold text-gray-950">Esta página no existe</h1>
    <p className="mt-2 max-w-md text-sm text-gray-500">
      Puede que el enlace esté mal escrito o que la página se haya movido.
    </p>
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Link
        to="/"
        className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
      >
        Volver al inicio
      </Link>
      <Link
        to="/properties"
        className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:text-indigo-600"
      >
        Ver viviendas
      </Link>
    </div>
  </div>
);

export default NotFound;

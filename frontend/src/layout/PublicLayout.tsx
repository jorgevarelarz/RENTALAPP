import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600">RentalApp</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/properties"
              className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
            >
              Ver Propiedades
            </Link>
            {user ? (
              <Link
                to="/tenant"
                className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
              >
                Mi Cuenta
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow-md transition-all"
              >
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

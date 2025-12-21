import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [roleIndex, setRoleIndex] = useState(0);

  const roles = [
    { text: 'Hogar', color: 'text-blue-600', bg: 'bg-blue-50' },
    { text: 'Propietarios', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { text: 'Profesionales', color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIndex(current => (current + 1) % roles.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [roles.length]);

  const activeRole = roles[roleIndex];

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center items-center bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center max-w-4xl mx-auto mb-16 space-y-6">
        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-2">
          RentalApp
          <span
            className={`block mt-2 sm:inline sm:mt-0 sm:ml-4 ${activeRole.color} transition-colors duration-500`}
          >
            {activeRole.text}
          </span>
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          La plataforma integral donde conviven alquileres seguros, gestión inteligente y servicios de calidad.
          <br className="hidden sm:block" />
          <span className="text-gray-400 text-lg mt-2 block">
            Sin intermediarios innecesarios. Todo digital. Todo seguro.
          </span>
        </p>
      </div>

      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <span className="uppercase tracking-wider text-sm font-bold text-gray-400">
            ¡Comienza ya! Elige tu perfil
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group relative bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-6xl">🏠</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Inquilinos</h3>
            <p className="text-gray-500 mb-6 min-h-[48px]">
              Encuentra tu hogar ideal, sin estafas y con contratos 100% digitales.
            </p>
            <Link
              to="/properties"
              className="block w-full py-3 px-4 bg-blue-50 text-blue-700 font-semibold rounded-lg text-center hover:bg-blue-600 hover:text-white transition-colors"
            >
              Busco Alquilar
            </Link>
          </div>

          <div className="group relative bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-6xl">🔑</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Propietarios</h3>
            <p className="text-gray-500 mb-6 min-h-[48px]">
              Gestiona tus rentas, automatiza cobros y accede a TenantPro.
            </p>
            <Link
              to="/register?role=landlord"
              className="block w-full py-3 px-4 bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-center hover:bg-emerald-600 hover:text-white transition-colors"
            >
              Soy Propietario
            </Link>
          </div>

          <div className="group relative bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-6xl">🛠️</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Profesionales</h3>
            <p className="text-gray-500 mb-6 min-h-[48px]">
              Recibe tickets de mantenimiento y haz crecer tu negocio de servicios.
            </p>
            <Link
              to="/register?role=pro"
              className="block w-full py-3 px-4 bg-orange-50 text-orange-700 font-semibold rounded-lg text-center hover:bg-orange-600 hover:text-white transition-colors"
            >
              Soy Profesional
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-24 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} RentalApp Inc. · Privacidad · Términos
      </div>
    </div>
  );
}

import React from 'react';
import { X } from 'lucide-react';
import { usePolicyAcceptance } from '../hooks/usePolicyAcceptance';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PolicyModal({ isOpen, onClose }: PolicyModalProps) {
  const { acceptPolicy } = usePolicyAcceptance();

  if (!isOpen) return null;

  const handleAccept = () => {
    acceptPolicy();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Cerrar"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-4">Política de Privacidad</h2>

        <div className="space-y-4 text-gray-700">
          <section>
            <h3 className="text-xl font-semibold mb-2">1. Introducción</h3>
            <p>
              En RENTALAPP, nos comprometemos a proteger su privacidad y garantizar la seguridad de su información personal.
              Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos su información cuando utiliza nuestra plataforma.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">2. Información que Recopilamos</h3>
            <p className="mb-2">Recopilamos los siguientes tipos de información:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Información de Cuenta:</strong> Nombre, correo electrónico, número de teléfono.</li>
              <li><strong>Información de Propiedades:</strong> Detalles de propiedades en alquiler, imágenes, ubicaciones.</li>
              <li><strong>Información de Uso:</strong> Datos sobre cómo interactúa con nuestra plataforma.</li>
              <li><strong>Información Técnica:</strong> Dirección IP, tipo de navegador, sistema operativo.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">3. Cómo Usamos su Información</h3>
            <p className="mb-2">Utilizamos su información para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Proporcionar y mantener nuestros servicios</li>
              <li>Procesar transacciones y gestionar su cuenta</li>
              <li>Enviar actualizaciones y notificaciones importantes</li>
              <li>Mejorar la experiencia del usuario</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">4. Compartir Información</h3>
            <p>
              No vendemos su información personal. Compartimos información solo con:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Proveedores de servicios que nos ayudan a operar la plataforma</li>
              <li>Autoridades cuando sea requerido por ley</li>
              <li>Con su consentimiento explícito</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">5. Seguridad de Datos</h3>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal contra acceso no autorizado,
              alteración, divulgación o destrucción.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">6. Sus Derechos</h3>
            <p className="mb-2">Usted tiene derecho a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Acceder a su información personal</li>
              <li>Rectificar información inexacta</li>
              <li>Solicitar la eliminación de su información</li>
              <li>Oponerse al procesamiento de sus datos</li>
              <li>Solicitar la portabilidad de sus datos</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">7. Cookies</h3>
            <p>
              Utilizamos cookies y tecnologías similares para mejorar su experiencia en nuestra plataforma.
              Puede configurar su navegador para rechazar cookies, aunque esto puede afectar algunas funcionalidades.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">8. Cambios a esta Política</h3>
            <p>
              Podemos actualizar esta Política de Privacidad ocasionalmente. Le notificaremos sobre cambios significativos
              mediante un aviso en nuestra plataforma o por correo electrónico.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">9. Contacto</h3>
            <p>
              Si tiene preguntas sobre esta Política de Privacidad, contáctenos en:
              <br />
              <strong>Email:</strong> privacy@rentalapp.com
              <br />
              <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-ES')}
            </p>
          </section>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleAccept}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            Aceptar y Continuar
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

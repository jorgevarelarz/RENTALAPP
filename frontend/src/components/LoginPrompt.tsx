import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Modal from './ui/Modal';
import { authHref, withIntent } from '../utils/authLinks';

export type LoginPromptReason = 'save' | 'apply';

// «back»: qué pasa al volver; «resume», si la página sabe completar la acción (la ficha).
// El listado no sabe qué piso era, así que solo vuelve.
const COPY: Record<LoginPromptReason, { title: string; text: string; back: string; resume: string }> = {
  save: {
    title: 'Guarda este piso',
    text: 'Con una cuenta gratuita guardas los pisos que te interesan y los tienes a mano en «Favoritos».',
    back: '',
    resume: 'Al terminar vuelves aquí con el piso ya guardado.',
  },
  apply: {
    title: 'Pide una visita',
    text: 'Para pedir visita y hablar con el propietario necesitas una cuenta gratuita.',
    back: 'Al terminar vuelves a este anuncio.',
    resume: 'Al terminar vuelves a este anuncio para escribir tu mensaje.',
  },
};

export default function LoginPrompt({
  open,
  onClose,
  reason = 'save',
  resume = false,
}: {
  open: boolean;
  onClose: () => void;
  reason?: LoginPromptReason;
  /** La página completa la acción al volver (?intent=save|apply) */
  resume?: boolean;
}) {
  const loc = useLocation();
  const copy = COPY[reason];
  // Al volver, la ficha guarda el piso o lleva al campo del mensaje sin que haya que pulsar otra vez
  const back = resume ? withIntent(loc, reason) : loc;
  return (
    <Modal open={open} onClose={onClose} title={copy.title} className="ra-login-prompt">
      <p className="ra-login-prompt-text">{[copy.text, resume ? copy.resume : copy.back].filter(Boolean).join(' ')}</p>
      <div className="ra-login-prompt-actions">
        <Link to={authHref('/register', back)} onClick={onClose} className="ra-button ra-button-blue ra-button-small">
          Crear cuenta
        </Link>
        <Link to={authHref('/login', back)} onClick={onClose} className="ra-app-login">
          Ya tengo cuenta
        </Link>
        <button type="button" onClick={onClose} className="ra-login-prompt-dismiss">
          Ahora no
        </button>
      </div>
    </Modal>
  );
}

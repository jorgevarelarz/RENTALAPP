import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Modal from './ui/Modal';
import { authHref } from '../utils/authLinks';

export type LoginPromptReason = 'save' | 'apply';

const COPY: Record<LoginPromptReason, { title: string; text: string }> = {
  save: {
    title: 'Guarda este piso',
    text: 'Con una cuenta gratuita guardas los pisos que te interesan y los tienes a mano en «Favoritos».',
  },
  apply: {
    title: 'Pide una visita',
    text: 'Para pedir visita y hablar con el propietario necesitas una cuenta gratuita. Al terminar vuelves a este anuncio.',
  },
};

export default function LoginPrompt({
  open,
  onClose,
  reason = 'save',
}: {
  open: boolean;
  onClose: () => void;
  reason?: LoginPromptReason;
}) {
  const loc = useLocation();
  const copy = COPY[reason];
  return (
    <Modal open={open} onClose={onClose} title={copy.title} className="ra-login-prompt">
      <p className="ra-login-prompt-text">{copy.text}</p>
      <div className="ra-login-prompt-actions">
        <Link to={authHref('/register', loc)} onClick={onClose} className="ra-button ra-button-blue ra-button-small">
          Crear cuenta
        </Link>
        <Link to={authHref('/login', loc)} onClick={onClose} className="ra-app-login">
          Ya tengo cuenta
        </Link>
        <button type="button" onClick={onClose} className="ra-login-prompt-dismiss">
          Ahora no
        </button>
      </div>
    </Modal>
  );
}

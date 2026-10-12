import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  /** Clases del contenedor (anchura en filas flex, etc.); className va al propio campo */
  containerClassName?: string;
};

const Input: React.FC<Props> = ({ label, className, containerClassName, ...rest }) => (
  <label className={['ra-field', containerClassName].filter(Boolean).join(' ')}>
    {label && <span className="ra-field-label">{label}</span>}
    <input {...rest} className={['ra-input', className].filter(Boolean).join(' ')} />
  </label>
);

export default Input;

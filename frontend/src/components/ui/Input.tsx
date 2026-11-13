import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  /** Clases del contenedor (anchura en filas flex, etc.); className va al propio campo */
  containerClassName?: string;
};

/** Reenvía la ref al <input> para poder usarlo con register() de react-hook-form */
const Input = React.forwardRef<HTMLInputElement, Props>(({ label, className, containerClassName, ...rest }, ref) => (
  <label className={['ra-field', containerClassName].filter(Boolean).join(' ')}>
    {label && <span className="ra-field-label">{label}</span>}
    <input ref={ref} {...rest} className={['ra-input', className].filter(Boolean).join(' ')} />
  </label>
));
Input.displayName = 'Input';

export default Input;

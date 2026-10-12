import React from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  /** Clases del contenedor; className va al propio desplegable */
  containerClassName?: string;
};

const Select: React.FC<Props> = ({ label, children, className, containerClassName, ...rest }) => (
  <label className={['ra-field', containerClassName].filter(Boolean).join(' ')}>
    {label && <span className="ra-field-label">{label}</span>}
    <select {...rest} className={['ra-input', className].filter(Boolean).join(' ')}>
      {children}
    </select>
  </label>
);

export default Select;

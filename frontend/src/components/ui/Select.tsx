import React from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  /** Clases del contenedor; className va al propio desplegable */
  containerClassName?: string;
};

/** Reenvía la ref al <select> para poder usarlo con register() de react-hook-form */
const Select = React.forwardRef<HTMLSelectElement, Props>(({ label, children, className, containerClassName, ...rest }, ref) => (
  <label className={['ra-field', containerClassName].filter(Boolean).join(' ')}>
    {label && <span className="ra-field-label">{label}</span>}
    <select ref={ref} {...rest} className={['ra-input', className].filter(Boolean).join(' ')}>
      {children}
    </select>
  </label>
));
Select.displayName = 'Select';

export default Select;

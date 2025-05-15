import React, { forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({ 
  className = '', 
  type = 'text',
  error,
  ...props 
}, ref) => {
  const inputClass = `input ${error ? 'input-error' : ''} ${className}`;
  
  return (
    <div className="input-wrapper">
      <input 
        className={inputClass}
        type={type}
        ref={ref}
        {...props}
      />
      {error && <div className="input-error-message">{error}</div>}
    </div>
  );
});

export default Input;
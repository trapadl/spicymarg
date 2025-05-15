import React from 'react';
import './Button.css';

export default function Button({ 
  children, 
  className = '', 
  variant = 'primary',
  size = 'medium',
  ...props 
}) {
  const buttonClass = `button ${variant}-button ${size}-button ${className}`;
  
  return (
    <button 
      className={buttonClass}
      {...props}
    >
      {children}
    </button>
  );
}
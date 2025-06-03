import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = "font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-card transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: 'bg-primary hover:bg-blue-700 text-white focus:ring-primary dark:bg-secondary dark:hover:bg-blue-500',
    secondary: 'bg-secondary hover:bg-blue-500 text-white focus:ring-secondary dark:bg-primary dark:hover:bg-blue-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600',
    outline: 'bg-transparent hover:bg-gray-100 text-primary border border-primary focus:ring-primary dark:text-secondary dark:border-secondary dark:hover:bg-gray-700',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-primary',
  };

  const sizeStyles = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2 px-4 text-sm',
    lg: 'py-2.5 px-6 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
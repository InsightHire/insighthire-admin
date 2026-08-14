import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'link' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  fullWidth?: boolean;
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    fullWidth = false,
    disabled,
    asChild = false,
    children, 
    ...props 
  }, ref) => {
    const buttonClasses = clsx(
      // Base styles
      'inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:pointer-events-none',
      fullWidth && 'w-full',
      
      // Variants
      {
        'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500': variant === 'primary',
        'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600': variant === 'secondary',
        'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500': variant === 'success',
        'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500': variant === 'warning',
        'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500': variant === 'error',
        'bg-transparent text-gray-900 hover:bg-gray-100 focus:ring-gray-500': variant === 'ghost',
        'bg-transparent text-blue-600 hover:text-blue-700 underline-offset-4 hover:underline focus:ring-blue-500': variant === 'link',
        'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500': variant === 'outline',
      },
      
      // Sizes
      {
        'h-8 px-3 text-xs': size === 'sm',
        'h-10 px-4 text-sm': size === 'md',
        'h-12 px-6 text-base': size === 'lg',
        'h-14 px-8 text-lg': size === 'xl',
      },
      
      className
    );

    if (asChild) {
      // Clone the child element and apply button styles
      const child = children as React.ReactElement;
      return React.cloneElement(child, {
        className: clsx(buttonClasses, child.props.className),
        ...props,
      });
    }

    return (
      <button
        className={buttonClasses}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };

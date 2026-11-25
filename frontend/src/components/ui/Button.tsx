import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  loadingText?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300',
  secondary: 'text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300',
  ghost: 'text-gray-500 hover:text-gray-800 disabled:opacity-50',
};

export default function Button({
  variant = 'primary',
  loading = false,
  loadingText,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`px-5 py-2.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {loadingText || 'Please wait…'}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
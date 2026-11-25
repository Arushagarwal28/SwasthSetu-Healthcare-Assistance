import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export default function TextField({ label, error, hint, id, className = '', ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={messageId}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={messageId} className="text-xs text-red-600 mt-1.5">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-slate-500 mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
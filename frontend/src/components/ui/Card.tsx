import type { ReactNode } from 'react';

interface Props {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function Card({ title, description, action, className = '', children }: Props) {
  return (
    <section
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
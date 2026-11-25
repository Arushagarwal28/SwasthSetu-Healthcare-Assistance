import type { ReactNode } from 'react';

export type ServiceIconName = 'assessment' | 'referral' | 'report' | 'assistant' | 'vaccination';

const PATHS: Record<ServiceIconName, ReactNode> = {
  assessment: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  referral: <path d="M4 12h15M14 7l5 5-5 5" />,
  report: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M10 13h6M10 17h6" />
    </>
  ),
  assistant: <path d="M4 5h16v11H9l-5 4z" />,
  vaccination: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

export default function ServiceIcon({ name }: { name: ServiceIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
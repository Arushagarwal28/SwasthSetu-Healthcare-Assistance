import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../brand/Logo';
import BridgeIllustration from '../brand/BridgeIllustration';

interface Props {
  heading: string;
  message: string;
  children: ReactNode;
}

export default function AuthLayout({ heading, message, children }: Props) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel — desktop only */}
      <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-700 to-blue-800 text-white p-10">
        <Link
          to="/"
          aria-label="SwasthSetu home"
          className="w-fit rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Logo light />
        </Link>

        <div>
          <BridgeIllustration className="w-full max-w-md mx-auto text-white/90" />
          <h2 className="text-2xl font-semibold mt-8">{heading}</h2>
          <p className="text-blue-100 mt-2 max-w-md leading-relaxed">{message}</p>
        </div>

        <p className="text-xs text-blue-200">
          Screening results are model-based suggestions, not a medical diagnosis.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col min-h-screen lg:min-h-0 bg-slate-50 px-4 py-8 sm:px-8">
        <div className="lg:hidden mb-6">
          <Link
            to="/"
            aria-label="SwasthSetu home"
            className="inline-block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Logo />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
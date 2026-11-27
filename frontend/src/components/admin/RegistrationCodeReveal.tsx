import { useState } from 'react';
import type { IssuedRegistrationCode } from '../../types/admin';
import Button from '../ui/Button';

interface Props {
  facilityName: string;
  issued: IssuedRegistrationCode;
  onClose: () => void;
}

const formatDate = (value: string | null): string | null => {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

export default function RegistrationCodeReveal({ facilityName, issued, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Could not copy automatically. Select the code and copy it manually.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-reveal-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="my-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="code-reveal-title" className="text-lg font-semibold text-slate-900">
          Registration code for {facilityName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Give this code to the hospital staff who should join this facility. They enter it when
          registering and are linked to the facility automatically.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Code</p>
          <p className="mt-1 select-all break-all font-mono text-lg font-semibold tracking-wide text-slate-900">
            {issued.code}
          </p>
          {issued.expiresAt && (
            <p className="mt-1 text-xs text-slate-500">Expires on {formatDate(issued.expiresAt)}</p>
          )}
        </div>

        <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          This is the only time the code is shown. It is stored only as a one-way keyed hash, so it
          cannot be retrieved later — rotate the code if it is lost.
        </div>

        {copyError && <p role="alert" className="mt-2 text-sm text-red-700">{copyError}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

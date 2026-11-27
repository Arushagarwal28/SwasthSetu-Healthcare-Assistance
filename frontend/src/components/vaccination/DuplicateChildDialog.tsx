import { Link } from 'react-router-dom';
import type { DuplicateChildMatch, DuplicateReason } from '../../types/vaccination';
import Button from '../ui/Button';

const REASON_LABEL: Record<DuplicateReason, string> = {
  SAME_MOBILE: 'same mobile number',
  SAME_MOTHER: 'same mother’s name',
  SAME_FATHER: 'same father’s name',
  SAME_CHILD_NAME: 'same child name',
};

interface Props {
  matches: DuplicateChildMatch[];
  message: string;
  basePath: string;
  busy: boolean;
  onRegisterAnyway: () => void;
  onClose: () => void;
}

export default function DuplicateChildDialog({
  matches,
  message,
  basePath,
  busy,
  onRegisterAnyway,
  onClose,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-lg p-6 my-4">
        <h2 id="duplicate-dialog-title" className="text-lg font-semibold text-slate-900">
          Possible duplicate record
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">{message}</p>

        <ul className="mt-4 space-y-3">
          {matches.map((match) => (
            <li
              key={`${match.recordNumber ?? 'hidden'}-${match.id ?? 'restricted'}`}
              className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"
            >
              {match.canView ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{match.fullName}</p>
                      <p className="text-xs text-slate-600">
                        {match.recordNumber} · born {match.dateOfBirth}
                      </p>
                      <p className="text-xs text-slate-600">
                        {match.village}, {match.district}
                      </p>
                    </div>
                    {match.id && (
                      <Link
                        to={`${basePath}/children/${match.id}`}
                        className="text-sm text-blue-700 hover:text-blue-900 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        Open record
                      </Link>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-amber-800">
                    Matched on {match.matchedOn.map((reason) => REASON_LABEL[reason]).join(', ')}.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-900">
                    Another existing record may match these details
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Its identity is hidden because you do not have access to it. Ask the parent or
                    guardian for the child’s vaccination record number and use{' '}
                    <span className="font-medium">Find a child by vaccination ID</span> to verify the
                    existing record instead of creating a duplicate. This warning never reveals the
                    other child’s name, record number, date of birth or address.
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-500">
          Twins legitimately share a date of birth, phone number and parents. Only register again if
          this is a different child.
        </p>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel — do not register
          </Button>
          <Button onClick={onRegisterAnyway} loading={busy} loadingText="Registering…">
            This is a different child — register anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
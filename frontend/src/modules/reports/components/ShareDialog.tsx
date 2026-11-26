import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import { getApiErrorMessage } from '../../../utils/errors';
import { searchShareTargets } from '../api';
import type { StaffTargetDto } from '../types';

interface Props {
  onClose: () => void;
  onSubmit: (userId: string, expiresAt?: string) => Promise<void>;
}

const MIN_QUERY = 2;

const facilityText = (target: StaffTargetDto): string => {
  if (target.facilities.length === 0) return 'No facility linked';
  return target.facilities.map((facility) => facility.name).join(', ');
};

/**
 * Shares this report with one hospital staff account.
 *
 * The account is found by searching staff emails or facility names, so nobody
 * has to copy a raw account id. The endpoint behind the search only lists
 * active hospital staff accounts and returns nothing but an email and the
 * facilities it belongs to.
 */
export default function ShareDialog({ onClose, onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffTargetDto[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<StaffTargetDto | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const term = query.trim();

  // Debounced search. State is only touched from the timer/response callbacks,
  // never synchronously while the effect runs.
  useEffect(() => {
    if (term.length < MIN_QUERY) return;

    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError('');
      searchShareTargets(term, 1)
        .then((response) => {
          if (!active) return;
          setResults(response.items);
          setTotal(response.pagination.total);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setResults([]);
          setTotal(0);
          setSearchError(
            getApiErrorMessage(err, 'The staff search is not available right now. Please try again.'),
          );
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) {
      setError('Search for the hospital staff member and choose their account first.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(selected.userId, expiresAt || undefined);
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'The report could not be shared. Check that the account is still an active hospital staff account.',
        ),
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      aria-describedby="share-intro"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !submitting) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 id="share-title" className="text-lg font-semibold text-slate-900">
          Share this report
        </h2>
        <p id="share-intro" className="mt-1 text-sm text-slate-600">
          This gives one hospital staff account read-only access. They cannot correct or delete the
          report, and you can revoke access at any time.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="share-search" className="mb-1.5 block text-sm font-medium text-slate-700">
              Find hospital staff
            </label>
            <input
              id="share-search"
              type="search"
              value={query}
              autoFocus
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
                setResults([]);
                setTotal(0);
                setSearchError('');
                setError('');
              }}
              placeholder="Staff email or facility name"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="share-search-help"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p id="share-search-help" className="mt-1 text-xs text-slate-500">
              Type at least {MIN_QUERY} characters. Ask the staff member for their sign-in email if
              you are unsure.
            </p>
          </div>

          <div aria-live="polite">
            {term.length > 0 && term.length < MIN_QUERY && (
              <p className="text-sm text-slate-500">Keep typing to search.</p>
            )}
            {searching && <p className="text-sm text-slate-500">Searching…</p>}
            {searchError && (
              <p role="alert" className="text-sm text-red-700">
                {searchError}
              </p>
            )}
          </div>

          {results.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-700">
                Matching hospital staff
              </legend>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {results.map((target) => {
                  const checked = selected?.userId === target.userId;
                  return (
                    <li key={target.userId}>
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 ${
                          checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="share-target"
                          checked={checked}
                          onChange={() => {
                            setSelected(target);
                            setError('');
                          }}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-medium text-slate-900 break-words">
                            {target.email}
                          </span>
                          <span className="block text-xs text-slate-500">{facilityText(target)}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {total > results.length && (
                <p className="mt-2 text-xs text-slate-500">
                  Showing {results.length} of {total} matches — add more of the email or facility
                  name to narrow the list.
                </p>
              )}
            </fieldset>
          )}

          {term.length >= MIN_QUERY && !searching && !searchError && results.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No active hospital staff account matches “{term}”. Check the spelling, or ask them
              which facility they are registered with.
            </p>
          )}

          {selected && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Sharing with <span className="font-medium break-words">{selected.email}</span>
              {selected.facilities.length > 0 ? ` · ${facilityText(selected)}` : ''}
            </p>
          )}

          <div>
            <label htmlFor="share-expiry" className="mb-1.5 block text-sm font-medium text-slate-700">
              Access ends on <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="share-expiry"
              type="date"
              value={expiresAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-slate-500">Leave blank to share until you revoke it.</p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} loadingText="Sharing…" disabled={!selected}>
              Share report
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

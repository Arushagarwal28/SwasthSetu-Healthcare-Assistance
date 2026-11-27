import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyFacilities, fetchVerifiedAccess, verifyChildAccess } from '../../api/vaccination';
import type { MyFacility, VerifiedAccessRecord, VerifiedAccessResult } from '../../types/vaccination';
import { getApiErrorMessage } from '../../utils/errors';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

interface Props {
  /** Vaccination module root, e.g. /hospital/vaccination */
  basePath: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const formatDate = (value: string): string =>
  new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

export default function FindChildPage({ basePath }: Props) {
  const [recordNumber, setRecordNumber] = useState('');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [consent, setConsent] = useState(false);
  const [facilities, setFacilities] = useState<MyFacility[]>([]);
  const [facilityId, setFacilityId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VerifiedAccessResult | null>(null);

  const [grants, setGrants] = useState<VerifiedAccessRecord[]>([]);
  const [grantsError, setGrantsError] = useState('');

  const loadGrants = useCallback(async () => {
    setGrantsError('');
    try {
      setGrants(await fetchVerifiedAccess());
    } catch (err) {
      setGrantsError(getApiErrorMessage(err, 'Could not load your temporary access list.'));
    }
  }, []);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  useEffect(() => {
    fetchMyFacilities()
      .then((rows) => setFacilities(rows.filter((row) => row.isActive)))
      .catch(() => setFacilities([]));
  }, []);

  const lastVaccinationText = (
    last: VerifiedAccessResult['child']['lastVaccination'] | VerifiedAccessRecord['lastVaccination']
  ): string => {
    if (!last) return 'No vaccination recorded yet';
    return last.facility
      ? `Last given ${formatDate(last.administeredOn)} at ${last.facility.name}`
      : `Last given ${formatDate(last.administeredOn)} · administering facility not recorded`;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!recordNumber.trim()) {
      setError('Enter the child’s vaccination record number.');
      return;
    }
    if (!guardianMobile.trim()) {
      setError('Enter the registered guardian’s mobile number.');
      return;
    }
    if (!dateOfBirth) {
      setError('Enter the child’s date of birth.');
      return;
    }
    if (facilities.length > 1 && !facilityId) {
      setError('Choose the facility where you are seeing this child.');
      return;
    }
    if (!consent) {
      setError('Confirm that the child’s identity was checked and guardian permission obtained.');
      return;
    }

    setSubmitting(true);
    try {
      const verified = await verifyChildAccess({
        recordNumber: recordNumber.trim(),
        guardianMobile: guardianMobile.trim(),
        dateOfBirth,
        guardianConsentConfirmed: true,
        ...(facilityId ? { facilityId } : {}),
      });
      setResult(verified);
      setConsent(false);
      await loadGrants();
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(
        status === 429
          ? 'Too many verification attempts. Please wait a few minutes and try again.'
          : getApiErrorMessage(err, 'These details do not match any child record.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Find a child by vaccination ID</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Use this when a child registered at another facility comes here for a dose. All three
          details must match the existing record; the child’s name is never used to search.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Verify the child’s identity">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="recordNumber" className={labelClass}>
                Vaccination record number
              </label>
              <input
                id="recordNumber"
                type="text"
                value={recordNumber}
                onChange={(e) => setRecordNumber(e.target.value.toUpperCase())}
                placeholder="e.g. SSV-000123"
                autoComplete="off"
                maxLength={32}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="guardianMobile" className={labelClass}>
                Registered guardian’s mobile number
              </label>
              <input
                id="guardianMobile"
                type="tel"
                inputMode="numeric"
                value={guardianMobile}
                onChange={(e) => setGuardianMobile(e.target.value)}
                placeholder="10-digit mobile number"
                autoComplete="off"
                maxLength={20}
                className={inputClass}
              />
            </div>

            {facilities.length > 1 && (
              <div>
                <label htmlFor="verifyFacility" className={labelClass}>
                  Facility where you are seeing the child
                </label>
                <select
                  id="verifyFacility"
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose a facility</option>
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  The temporary access is issued here, and doses you record are attributed to it.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="dateOfBirth" className={labelClass}>
                Child’s date of birth
              </label>
              <input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
              <label htmlFor="guardianConsent" className="flex items-start gap-2.5 text-sm text-slate-700">
                <input
                  id="guardianConsent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                />
                <span>
                  I have checked the child’s identity and obtained permission from the parent or
                  guardian to view and update this vaccination record.
                </span>
              </label>
              <p className="mt-2 text-xs text-slate-500">
                This is a staff confirmation, not proof of guardianship. Access is temporary, tied
                to your account and facility, and is recorded in the audit trail.
              </p>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} loadingText="Checking…">
              Verify and open access
            </Button>
          </form>

          {result && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            >
              <p className="font-semibold">Identity verified</p>
              <p className="mt-1">
                {result.child.fullName} · {result.child.recordNumber} · born{' '}
                {formatDate(result.child.dateOfBirth)}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                {lastVaccinationText(result.child.lastVaccination)} · temporary access ends{' '}
                {formatDateTime(result.access.expiresAt)}
              </p>
              <Link
                to={`${basePath}/children/${result.child.id}`}
                className="mt-3 inline-flex items-center rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Open vaccination record
              </Link>
            </div>
          )}
        </Card>

        <Card title="Temporary access you hold">
          {grantsError ? (
            <p role="alert" className="text-sm text-red-700">{grantsError}</p>
          ) : grants.length === 0 ? (
            <p className="text-sm text-slate-500">
              No temporary cross-facility access right now. Verified access ends automatically.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {grants.map((grant) => (
                <li key={grant.childId} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <Link
                    to={`${basePath}/children/${grant.childId}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    {grant.fullName} · {grant.recordNumber}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {lastVaccinationText(grant.lastVaccination)} · access ends{' '}
                    {formatDateTime(grant.expiresAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Access is limited to the children you verified. Your facility is recorded on every dose
            you enter.
          </p>
        </Card>
      </div>
    </div>
  );
}

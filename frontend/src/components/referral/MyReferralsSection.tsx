import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyReferrals } from '../../api/referrals';
import type { ReferralSummary } from '../../types/referral';
import { formatDateTime } from '../../utils/date';
import { getApiErrorMessage } from '../../utils/errors';
import { useReferralUpdates } from '../../realtime/useReferralUpdates';
import Card from '../ui/Card';
import ErrorBlock from '../ui/ErrorBlock';
import EmptyState from '../ui/EmptyState';
import ReferralStatusBadge from './ReferralStatusBadge';

const VISIBLE_BY_DEFAULT = 5;

interface Props {
  /** '/patient' or '/helper' — used to open a referral's detail page. */
  basePath: string;
  /** Helpers see several patients, so show whose referral each row is. */
  showPatientName?: boolean;
}

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 animate-pulse">
      <div className="space-y-2 flex-1">
        <div className="h-3.5 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
      <div className="h-5 w-16 rounded-full bg-slate-100" />
    </div>
  );
}

export default function MyReferralsSection({ basePath, showPatientName = false }: Props) {
  const [referrals, setReferrals] = useState<ReferralSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setReferrals(await fetchMyReferrals());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your referrals. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: a hospital responded (or a referral was created) — refresh quietly
  useReferralUpdates(() => {
    load(true);
  });

  const visible = showAll ? referrals : referrals.slice(0, VISIBLE_BY_DEFAULT);

  return (
    <Card
      title="My Referrals"
      description={
        showPatientName
          ? 'Referrals for your linked patients, most recently updated first.'
          : 'Referrals you have requested, most recently updated first.'
      }
    >
      {loading && (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Loading referrals…</span>
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {!loading && error && <ErrorBlock message={error} onRetry={() => load()} />}

      {!loading && !error && referrals.length === 0 && (
        <EmptyState
          title="No referrals yet"
          description="After a completed assessment, request a referral from the recommended facilities."
        />
      )}

      {!loading && !error && referrals.length > 0 && (
        <>
          <ul className="space-y-3">
            {visible.map((r) => {
              const showTime =
                r.scheduledAt && (r.status === 'ACCEPTED' || r.status === 'RESCHEDULED');
              return (
                <li key={r.id}>
                  <Link
                    to={`${basePath}/assessment/${r.assessmentId}/recommendations`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {r.destinationFacility.name}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {showPatientName ? `${r.patient.fullName} · ` : ''}
                        {r.assessment.predictedDisease ?? 'Screening result unavailable'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {showTime
                          ? `${r.status === 'RESCHEDULED' ? 'Proposed' : 'Appointment'}: ${formatDateTime(r.scheduledAt!)}`
                          : `Updated ${formatDateTime(r.updatedAt)}`}
                      </p>
                    </div>
                    <ReferralStatusBadge status={r.status} />
                  </Link>
                </li>
              );
            })}
          </ul>

          {referrals.length > VISIBLE_BY_DEFAULT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {showAll ? 'Show fewer' : `Show all (${referrals.length})`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
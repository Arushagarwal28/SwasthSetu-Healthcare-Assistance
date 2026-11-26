import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import {
  acceptReferral,
  completeReferral,
  fetchIncomingReferrals,
  rejectReferral,
  rescheduleReferral,
} from '../../api/referrals';
import type { IncomingReferral, IncomingReferralsResponse, ReferralStatus } from '../../types/referral';
import { getApiErrorMessage } from '../../utils/errors';
import { useReferralUpdates } from '../../realtime/useReferralUpdates';
import DashboardShell from '../../components/layout/DashboardShell';
import { secondaryButtonLink } from '../../components/ui/buttonLink';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import IncomingReferralCard from '../../components/referral/IncomingReferralCard';
import ReferralActionModal from '../../components/referral/ReferralActionModal';
import type { ActionMode } from '../../components/referral/ReferralActionModal';
import VaccinationModule from '../vaccination/VaccinationModule';
import ReportModule from '../../modules/reports/ReportModule';

const TABS: { label: string; status: ReferralStatus }[] = [
  { label: 'Pending', status: 'PENDING' },
  { label: 'Accepted', status: 'ACCEPTED' },
  { label: 'Rescheduled', status: 'RESCHEDULED' },
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Rejected', status: 'REJECTED' },
];

const SUCCESS_MESSAGE: Record<ActionMode, string> = {
  accept: 'Referral accepted.',
  reject: 'Referral rejected. The referrer can now choose another facility.',
  reschedule: 'New time proposed.',
  complete: 'Referral marked as completed.',
};

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-3 w-1/2 rounded bg-slate-100 mt-2" />
      <div className="h-16 rounded bg-slate-100 mt-4" />
      <div className="h-9 w-1/2 rounded bg-slate-100 mt-4" />
    </div>
  );
}

function HospitalReferralsHome() {
  const [status, setStatus] = useState<ReferralStatus>('PENDING');
  const [data, setData] = useState<IncomingReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState<{ referral: IncomingReferral; mode: ActionMode } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchIncomingReferrals(status));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load referrals. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: a referral arrived or changed, so refresh the current tab
  useReferralUpdates((event) => {
    load();
    if (event?.kind === 'created') setNotice('A new referral was received.');
  });

  const submitAction = async (values: { scheduledAt?: string; note: string }) => {
    if (!action) return;
    const { referral, mode } = action;

    if (mode === 'accept') {
      await acceptReferral(referral.id, { scheduledAt: values.scheduledAt, note: values.note || undefined });
    } else if (mode === 'reject') {
      await rejectReferral(referral.id, values.note);
    } else if (mode === 'reschedule') {
      await rescheduleReferral(referral.id, values.scheduledAt!, values.note || undefined);
    } else {
      await completeReferral(referral.id, values.note || undefined);
    }

    setAction(null);
    setNotice(SUCCESS_MESSAGE[mode]);
    await load();
  };

  const notLinked = !loading && !error && data && data.facilities.length === 0;

  return (
    <DashboardShell roleLabel="Hospital Staff">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Incoming Referrals</h1>
            {data && data.facilities.length > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                Receiving for: {data.facilities.map((f) => f.name).join(', ')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/hospital/reports" className={secondaryButtonLink}>
              Medical Reports
            </Link>
            <Link to="/hospital/vaccination" className={secondaryButtonLink}>
              Vaccination Tracker
            </Link>
            <Button variant="secondary" onClick={load} loading={loading} loadingText="Refreshing…">
              Refresh
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="Referral status" className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {TABS.map((tab) => {
            const active = tab.status === status;
            return (
              <button
                key={tab.status}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatus(tab.status);
                  setNotice('');
                }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {notice && (
          <div role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
            {notice}
          </div>
        )}

        {loading && !data && (
          <div className="space-y-4" aria-busy="true">
            <span className="sr-only">Loading referrals…</span>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && error && <ErrorBlock message={error} onRetry={load} />}

        {notLinked && (
          <EmptyState
            title="Your account isn't linked to a facility yet"
            description="Ask an administrator to link your account to your hospital so referrals can reach you."
          />
        )}

        {!error && data && data.facilities.length > 0 && data.referrals.length === 0 && !loading && (
          <EmptyState
            title={`No ${TABS.find((t) => t.status === status)!.label.toLowerCase()} referrals`}
            description="New referrals sent to your facility will appear here."
          />
        )}

        {!error && data && data.referrals.length > 0 && (
          <div className="space-y-4">
            {data.referrals.map((r) => (
              <IncomingReferralCard
                key={r.id}
                referral={r}
                onAction={(mode) => {
                  setNotice('');
                  setAction({ referral: r, mode });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {action && (
        <ReferralActionModal
          mode={action.mode}
          patientName={action.referral.patient.fullName}
          onSubmit={submitAction}
          onClose={() => setAction(null)}
        />
      )}
    </DashboardShell>
  );
}

export default function HospitalDashboard() {
  return (
    <Routes>
      <Route index element={<HospitalReferralsHome />} />
      <Route
        path="vaccination/*"
        element={
          <VaccinationModule
            role="HOSPITAL_STAFF"
            basePath="/hospital/vaccination"
            dashboardPath="/hospital"
          />
        }
      />
      <Route
        path="reports/*"
        element={<ReportModule role="HOSPITAL_STAFF" basePath="/hospital/reports" />}
      />
    </Routes>
  );
}
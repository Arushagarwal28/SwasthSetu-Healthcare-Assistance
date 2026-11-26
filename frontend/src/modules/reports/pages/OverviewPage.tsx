import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchReports } from '../api';
import { fetchLinkedPatients } from '../../../api/helpers';
import type { Patient } from '../../../types/patient';
import type { ReportRole, ReportSummaryDto } from '../types';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorBlock from '../../../components/ui/ErrorBlock';
import { primaryButtonLink, secondaryButtonLink } from '../../../components/ui/buttonLink';
import ReportListItem from '../components/ReportListItem';
import { useRemoteData } from '../useRemoteData';

interface Props {
  role: ReportRole;
  basePath: string;
}

const COPY: Record<ReportRole, { heading: string; intro: string; listTitle: string }> = {
  PATIENT: {
    heading: 'Your reports, in plain language',
    intro:
      'Upload a lab or hospital report and read a simplified explanation in English or Hindi. Results that could not be read confidently are marked for you to check.',
    listTitle: 'Recent reports',
  },
  HELPER: {
    heading: 'Reports for the patients you assist',
    intro:
      'Upload a report for a patient linked to your account and review the simplified explanation with them.',
    listTitle: 'Recent reports for your patients',
  },
  HOSPITAL_STAFF: {
    heading: 'Reports shared with you',
    intro:
      'Patients and helpers can share a simplified report with your hospital staff account. Access is read-only and can be revoked at any time.',
    listTitle: 'Shared reports',
  },
  ADMIN: {
    heading: 'Medical report programme',
    intro: 'Aggregate figures only.',
    listTitle: 'Reports',
  },
};

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true">
      <span className="sr-only">Loading reports…</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="animate-pulse px-4 py-4">
          <div className="h-3.5 w-1/3 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-24 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage({ role, basePath }: Props) {
  const copy = COPY[role];
  const canUpload = role === 'PATIENT' || role === 'HELPER';

  const load = useCallback(async () => {
    const [list, needsReview, linked] = await Promise.all([
      fetchReports({ pageSize: 6, sort: 'uploaded', order: 'desc' }),
      fetchReports({ pageSize: 1, needsReview: true }),
      role === 'HELPER' ? fetchLinkedPatients() : Promise.resolve<Patient[]>([]),
    ]);
    return {
      recent: list.items,
      total: list.pagination.total,
      toVerify: needsReview.pagination.total,
      patients: linked,
    };
  }, [role]);

  const { loading, data, error, reload } = useRemoteData(
    `overview:${role}`,
    load,
    'Could not load your reports. Please try again.',
  );

  const recent: ReportSummaryDto[] = data?.recent ?? [];
  const total = data?.total ?? 0;
  const toVerify = data?.toVerify ?? 0;
  const patients: Patient[] = data?.patients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{copy.heading}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{copy.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpload && (
            <Link to={`${basePath}/upload`} className={primaryButtonLink}>
              + Upload report
            </Link>
          )}
          <Link to={`${basePath}/history`} className={secondaryButtonLink}>
            All reports
          </Link>
        </div>
      </div>

      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Reports available" value={String(total)} />
          <StatCard
            label="Waiting for your check"
            value={String(toVerify)}
            note={toVerify > 0 ? 'Results that could not be read confidently' : 'Nothing pending'}
          />
          <StatCard
            label={role === 'HELPER' ? 'Patients you assist' : 'Report reading'}
            value={role === 'HELPER' ? String(patients.length) : 'PDF, PNG, JPG'}
            note={role === 'HELPER' ? 'Linked to your account' : 'Up to 15 MB per report'}
          />
        </div>
      )}

      {toVerify > 0 && !loading && !error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            <span aria-hidden="true">⚠ </span>
            {toVerify} report{toVerify === 1 ? '' : 's'} contain results that need manual verification.
          </p>
          <p className="mt-1 text-amber-800">
            These are not confirmed findings yet. Open the report and check the value against the
            printed paper before relying on it.
          </p>
          <Link
            to={`${basePath}/history?needsReview=true`}
            className="mt-2 inline-block font-medium text-amber-900 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Review them now
          </Link>
        </div>
      )}

      <Card title={copy.listTitle} className="!p-0">
        {loading && <ListSkeleton />}
        {!loading && error && (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && recent.length === 0 && (
          <div className="p-5">
            <EmptyState
              title={role === 'HOSPITAL_STAFF' ? 'No reports shared with you yet' : 'No reports yet'}
              description={
                role === 'HOSPITAL_STAFF'
                  ? 'When a patient or helper shares a simplified report with your account, it will appear here.'
                  : 'Upload a printed lab or hospital report to get a plain-language explanation.'
              }
              action={
                canUpload ? (
                  <Link to={`${basePath}/upload`} className={primaryButtonLink}>
                    Upload a report
                  </Link>
                ) : undefined
              }
            />
          </div>
        )}
        {!loading && !error && recent.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {recent.map((report) => (
              <ReportListItem
                key={report.id}
                report={report}
                basePath={basePath}
                patientName={role === 'PATIENT' ? undefined : (report.patientName ?? undefined)}
              />
            ))}
          </ul>
        )}
      </Card>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">How a report is handled</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>The uploaded file is read once and is not stored on the server.</li>
          <li>Only the structured results and their explanations are kept, so you can review them later.</li>
          <li>
            Reference ranges are the ones printed on your report. SwasthSetu does not invent a
            normal range.
          </li>
          <li>
            An explanation is not a diagnosis. Always confirm with a doctor before changing any
            treatment.
          </li>
        </ul>
      </section>
    </div>
  );
}

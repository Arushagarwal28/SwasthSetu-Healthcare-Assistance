import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import type { ReportRole } from './types';
import Spinner from '../../components/ui/Spinner';

/**
 * Screens are loaded on demand, so opening the reports module does not pull
 * every page (and the comparison code) into the initial bundle. The shell,
 * navigation and role badge stay in the main chunk.
 */
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const AdminStatsPage = lazy(() => import('./pages/AdminStatsPage'));

/**
 * Medical Report Simplifier shell.
 *
 * Mounted by the patient, helper, hospital and admin dashboards, so every route
 * inside is relative and the module never hard-codes its own base path:
 *
 *   <Route
 *     path="reports/*"
 *     element={<ReportModule role="PATIENT" basePath="/patient/reports" />}
 *   />
 *
 * The `*` in the parent route is required for the nested routes to match.
 * Administrators get aggregate figures only and can never reach a report.
 */

export interface ReportModuleProps {
  role: ReportRole;
  basePath: string;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const ROLE_LABEL: Record<ReportRole, string> = {
  PATIENT: 'Patient',
  HELPER: 'Helper',
  HOSPITAL_STAFF: 'Hospital staff',
  ADMIN: 'Administrator',
};

const ROLE_BADGE: Record<ReportRole, string> = {
  PATIENT: 'bg-blue-50 text-blue-700 ring-blue-200',
  HELPER: 'bg-blue-50 text-blue-700 ring-blue-200',
  HOSPITAL_STAFF: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ADMIN: 'bg-purple-50 text-purple-700 ring-purple-200',
};

const TITLE: Record<ReportRole, string> = {
  PATIENT: 'Medical reports made easier to read',
  HELPER: 'Medical reports for your patients',
  HOSPITAL_STAFF: 'Reports shared with your hospital',
  ADMIN: 'Medical report programme',
};

const DESCRIPTION: Record<ReportRole, string> = {
  PATIENT:
    'Upload a printed report and read the results in plain language, with the range printed on the report and a clear note when something needs checking.',
  HELPER:
    'Upload and review reports for patients linked to your account. Corrections are recorded with your account and the original reading is kept.',
  HOSPITAL_STAFF:
    'Read-only view of reports explicitly shared with your account. Nothing here is editable, and patients can revoke access at any time.',
  ADMIN:
    'Aggregate figures only. Administrators cannot open, search or export an individual medical report.',
};

export default function ReportModule({ role, basePath }: ReportModuleProps) {
  const isAdmin = role === 'ADMIN';
  const canUpload = role === 'PATIENT' || role === 'HELPER';

  const navItems: NavItem[] = isAdmin
    ? [{ to: 'stats', label: 'Programme figures', end: true }]
    : [
        { to: '', label: 'Overview', end: true },
        ...(canUpload ? [{ to: 'upload', label: 'Upload' }] : []),
        { to: 'history', label: 'History' },
        { to: 'compare', label: 'Compare' },
      ];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
            Medical Report Simplifier
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ROLE_BADGE[role]}`}
          >
            {ROLE_LABEL[role]}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{TITLE[role]}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{DESCRIPTION[role]}</p>
      </header>

      <nav aria-label="Medical report sections" className="border-b border-slate-200">
        <ul className="-mb-px flex flex-wrap gap-1">
          {navItems.map((item) => (
            <li key={item.to || 'overview'}>
              <NavLink
                to={item.to ? `${basePath}/${item.to}` : basePath}
                end={item.end}
                className={({ isActive }) =>
                  `inline-block rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense
        fallback={
          <div className="py-6">
            <Spinner label="Loading reports…" />
          </div>
        }
      >
      <Routes>
        <Route
          index
          element={
            isAdmin ? <Navigate to="stats" replace /> : <OverviewPage role={role} basePath={basePath} />
          }
        />

        <Route
          path="upload"
          element={
            canUpload ? (
              <UploadPage role={role} basePath={basePath} />
            ) : (
              <Navigate to=".." replace />
            )
          }
        />

        <Route path="history" element={<HistoryPage role={role} basePath={basePath} />} />

        <Route
          path="compare"
          element={isAdmin ? <Navigate to=".." replace /> : <ComparePage basePath={basePath} />}
        />

        <Route
          path=":reportId"
          element={
            isAdmin ? (
              <Navigate to=".." replace />
            ) : (
              <ReportDetailPageWrapper role={role} basePath={basePath} />
            )
          }
        />

        <Route path="stats" element={isAdmin ? <AdminStatsPage /> : <Navigate to=".." replace />} />

        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
      </Suspense>
    </div>
  );
}

/** Reads the route parameter for the detail page (kept separate for clarity). */
function ReportDetailPageWrapper({ role, basePath }: { role: ReportRole; basePath: string }) {
  const { reportId } = useParams<{ reportId: string }>();
  // Keyed by report id so switching reports remounts the page with fresh state
  // instead of resetting state from inside an effect.
  return (
    <ReportDetailPage
      key={String(reportId)}
      role={role}
      basePath={basePath}
      reportId={String(reportId)}
    />
  );
}

import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ChildrenListPage from './ChildrenListPage';
import RegisterChildPage from './RegisterChildPage';
import ChildRecordPage from './ChildRecordPage';
import VaccinationWorklistPage from './VaccinationWorklistPage';
import VaccinationNotificationsPage from './VaccinationNotificationsPage';
import NotificationBell from '../../components/vaccination/NotificationBell';
import CentresPage from './CentresPage';
import CentreDetailPage from './CentreDetailPage';
import VaccinationStatsPage from './VaccinationStatsPage';
import AdminStatsPage from './AdminStatsPage';
import AdminSchedulePage from './AdminSchedulePage';

/**
 * Vaccination module shell.
 *
 * Mounted by the helper, hospital and admin dashboards as `vaccination/*`, so
 * every route inside it is relative and the module never hard-codes its own
 * base path. ADMIN mounts the same shell without the children routes: admins
 * get aggregate statistics and reference data only, never an individual record.
 *
 * Mounting requirement (dashboards):
 *   <Route path="vaccination/*" element={<VaccinationModule role="HELPER" basePath={`${basePath}/vaccination`} dashboardPath={basePath} />} />
 * The `*` is required; without it the nested routes below never match.
 */

export type VaccinationRole = 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN';

interface VaccinationModuleProps {
  role: VaccinationRole;
  basePath: string;
  dashboardPath: string;
}

type ModuleRole = 'helper' | 'hospital' | 'admin';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const STAFF_NAV: NavItem[] = [
  { to: 'children', label: 'Children', end: true },
  { to: 'children/new', label: 'Register child', end: true },
  { to: 'worklist', label: 'Worklist' },
  { to: 'stats', label: 'Overview' },
  { to: 'centres', label: 'Centres' },
  { to: 'notifications', label: 'Notifications' },
];

const ADMIN_NAV: NavItem[] = [
  { to: 'stats', label: 'Programme figures' },
  { to: 'vaccines', label: 'Vaccines & schedule' },
  { to: 'centres', label: 'Centres' },
];

const ROLE_LABEL: Record<ModuleRole, string> = {
  helper: 'Helper',
  hospital: 'Hospital staff',
  admin: 'Administrator',
};

const ROLE_BADGE: Record<ModuleRole, string> = {
  helper: 'bg-blue-50 text-blue-700 ring-blue-200',
  hospital: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  admin: 'bg-purple-50 text-purple-700 ring-purple-200',
};

const ROLE_FROM_ACCOUNT: Record<VaccinationRole, ModuleRole> = {
  PATIENT: 'helper',
  HELPER: 'helper',
  HOSPITAL_STAFF: 'hospital',
  ADMIN: 'admin',
};

const roleFromBasePath = (basePath: string): ModuleRole => {
  if (basePath.includes('/admin')) return 'admin';
  if (basePath.includes('/hospital')) return 'hospital';
  return 'helper';
};

/**
 * The module is rendered under a splat route, so its own mount point is the
 * pathname up to and including "/vaccination". Deriving it keeps the module
 * correct for every dashboard without duplicating role checks here.
 */
function resolveBasePath(explicit: string | undefined, pathname: string): string {
  if (explicit) {
    const trimmed = explicit.replace(/\/+$/, '');
    return trimmed === '' ? '/helper/vaccination' : trimmed;
  }
  const marker = '/vaccination';
  const index = pathname.indexOf(marker);
  return index === -1 ? '/helper/vaccination' : pathname.slice(0, index + marker.length);
}

export default function VaccinationModule({
  role: accountRole,
  basePath: explicitBasePath,
}: VaccinationModuleProps) {
  const { pathname } = useLocation();
  const basePath = resolveBasePath(explicitBasePath, pathname);
  const role = accountRole ? ROLE_FROM_ACCOUNT[accountRole] : roleFromBasePath(basePath);
  const isAdmin = role === 'admin';
  const navItems = isAdmin ? ADMIN_NAV : STAFF_NAV;
  const home = isAdmin ? 'stats' : 'children';

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
            Vaccination tracker
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ROLE_BADGE[role]}`}
          >
            {ROLE_LABEL[role]}
          </span>
          <NotificationBell basePath={basePath} />
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {isAdmin ? 'Vaccination programme' : 'Children and doses'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAdmin
            ? 'Programme-level figures and reference data. Individual child records are not available to administrators.'
            : 'Register children, follow every due date, and record doses as they are given.'}
        </p>
      </header>

      <nav aria-label="Vaccination sections" className="border-b border-slate-200">
        <ul className="-mb-px flex flex-wrap gap-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={`${basePath}/${item.to}`}
                end={item.end}
                className={({ isActive }) =>
                  `inline-block rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
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

      <Routes>
        <Route index element={<Navigate to={home} replace />} />

        {isAdmin ? (
          <>
            <Route path="stats" element={<AdminStatsPage />} />
            <Route path="vaccines" element={<AdminSchedulePage />} />
            <Route path="centres" element={<CentresPage />} />
            <Route path="centres/:facilityId" element={<CentreDetailPage />} />
          </>
        ) : (
          <>
            <Route path="children" element={<ChildrenListPage basePath={basePath} />} />
            <Route path="children/new" element={<RegisterChildPage basePath={basePath} />} />
            <Route path="children/:childId" element={<ChildRecordPage basePath={basePath} />} />
            <Route path="worklist" element={<VaccinationWorklistPage />} />
            <Route path="stats" element={<VaccinationStatsPage />} />
            <Route path="notifications" element={<VaccinationNotificationsPage />} />
            <Route path="centres" element={<CentresPage />} />
            <Route path="centres/:facilityId" element={<CentreDetailPage />} />
          </>
        )}

        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </div>
  );
}
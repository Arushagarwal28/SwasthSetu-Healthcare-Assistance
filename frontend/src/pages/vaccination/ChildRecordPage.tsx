import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchChildDashboard, fetchChildProfile } from '../../api/vaccination';
import type { ChildDashboard, ChildDashboardDose } from '../../types/vaccination';
import Spinner from '../../components/ui/Spinner';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Card from '../../components/ui/Card';
import ChildSummaryCards from '../../components/vaccination/ChildSummaryCards';
import ChildNextVisitCard from '../../components/vaccination/ChildNextVisitCard';
import ChildActivityList from '../../components/vaccination/ChildActivityList';
import ChildDetailsCard from '../../components/vaccination/ChildDetailsCard';
import DoseList from '../../components/vaccination/DoseList';
import DoseActionDialog from '../../components/vaccination/DoseActionDialog';

type ChildProfileData = Awaited<ReturnType<typeof fetchChildProfile>>;

interface ChildRecordPageProps {
  basePath: string;
}

const capitalise = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase();

export default function ChildRecordPage({ basePath }: ChildRecordPageProps) {
  const { childId } = useParams<{ childId: string }>();
  const [dashboard, setDashboard] = useState<ChildDashboard | null>(null);
  const [profile, setProfile] = useState<ChildProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDose, setActiveDose] = useState<ChildDashboardDose | null>(null);

  const load = useCallback(async () => {
    if (!childId) {
      setError('No child was selected.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [childDashboard, childProfile] = await Promise.all([
        fetchChildDashboard(childId),
        fetchChildProfile(childId),
      ]);
      setDashboard(childDashboard);
      setProfile(childProfile);
    } catch {
      setError(
        "Could not load this child's record. It may have been removed, or your account may not have access to it."
      );
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !dashboard) {
    return <Spinner label="Loading the child's record…" />;
  }

  if (!dashboard) {
    return (
      <Card>
        <ErrorBlock
          message={error || 'This child record could not be loaded.'}
          onRetry={() => void load()}
        />
      </Card>
    );
  }

  const child = dashboard.child;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to={`${basePath}/children`}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            ← All children
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{child.fullName}</h2>
          <p className="text-sm text-slate-500">
            {child.recordNumber} · {child.age} · {capitalise(child.gender)}
          </p>
        </div>
        <p className="text-xs text-slate-500">As of {dashboard.asOf}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {dashboard.accessType === 'VERIFIED' && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Temporary cross-facility access</p>
          <p className="mt-0.5">
            You verified this child using their vaccination ID, guardian mobile number and date of
            birth, and confirmed guardian permission.
            {dashboard.accessExpiresAt
              ? ` Access ends ${new Date(dashboard.accessExpiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`
              : ''}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            You can view the history, record a dose and mark a dose postponed or not given. Personal
            details and doses recorded by another facility cannot be changed here.
          </p>
        </div>
      )}

      <ChildSummaryCards summary={dashboard.summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChildNextVisitCard nextVisit={dashboard.nextVisit} />
        <ChildDetailsCard child={child} profile={profile} />
      </div>

      <DoseList
        title="Overdue"
        description="Doses that are past their due date."
        doses={dashboard.overdue}
        emptyText="Nothing is overdue for this child."
        onAction={setActiveDose}
      />
      <DoseList
        title="Due today"
        doses={dashboard.dueToday}
        emptyText="No doses are due today."
        onAction={setActiveDose}
      />
      <DoseList
        title="Upcoming and postponed"
        doses={dashboard.upcoming}
        emptyText="No upcoming doses."
        onAction={setActiveDose}
      />
      <DoseList
        title="Given"
        description="Newest first."
        doses={dashboard.completed}
        emptyText="No doses have been recorded yet."
        onAction={setActiveDose}
        allowCorrections={dashboard.accessType !== 'VERIFIED'}
      />
      <DoseList
        title="Not given"
        doses={dashboard.notGiven}
        emptyText="No doses are marked as not given."
        onAction={setActiveDose}
      />

      <ChildActivityList entries={dashboard.recentActivity} />

      {activeDose && (
        <DoseActionDialog
          key={activeDose.id}
          childId={child.id}
          childDateOfBirth={child.dateOfBirth}
          dose={activeDose}
          onClose={() => setActiveDose(null)}
          onSaved={() => {
            setActiveDose(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { createFacility, fetchAdminOverview, fetchUnlinkedStaff, linkStaff, updateFacility } from '../../api/admin';
import type {
  AdminFacility, AdminOverview, FacilityFormValues, IssuedRegistrationCode, UnlinkedStaff,
} from '../../types/admin';
import { getApiErrorMessage } from '../../utils/errors';
import DashboardShell from '../../components/layout/DashboardShell';
import { secondaryButtonLink } from '../../components/ui/buttonLink';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import AdminFacilityCard from '../../components/admin/AdminFacilityCard';
import FacilityFormModal from '../../components/admin/FacilityFormModal';
import RegistrationCodeReveal from '../../components/admin/RegistrationCodeReveal';
import VaccinationModule from '../vaccination/VaccinationModule';
import ReportModule from '../../modules/reports/ReportModule';

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
      <div className="h-4 w-1/2 rounded bg-slate-200" />
      <div className="h-3 w-2/3 rounded bg-slate-100 mt-2" />
      <div className="h-20 rounded bg-slate-100 mt-5" />
      <div className="h-20 rounded bg-slate-100 mt-4" />
    </div>
  );
}

function AdminFacilitiesHome() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  // undefined = closed, null = creating, facility = editing
  const [form, setForm] = useState<AdminFacility | null | undefined>(undefined);
  // The code is only ever available in this response, so it is held here once.
  const [newCode, setNewCode] = useState<{ facilityName: string; issued: IssuedRegistrationCode } | null>(null);

  // Staff who registered before facility codes existed may have no facility yet.
  const [unlinked, setUnlinked] = useState<UnlinkedStaff[]>([]);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextOverview, nextUnlinked] = await Promise.all([
        fetchAdminOverview(),
        fetchUnlinkedStaff().catch(() => [] as UnlinkedStaff[]),
      ]);
      setOverview(nextOverview);
      setUnlinked(nextUnlinked);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load facilities. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChanged = async (message?: string) => {
    if (message) setNotice(message);
    await load();
  };

  const handleFormSubmit = async (values: FacilityFormValues) => {
    if (form) {
      await updateFacility(form.id, values);
      setNotice(`${values.name} updated.`);
    } else {
      const created = await createFacility(values);
      if (created?.registrationCode?.code) {
        setNewCode({ facilityName: created.name, issued: created.registrationCode });
      }
      setNotice(`${values.name} added. Give its registration code to the staff who should join it.`);
    }
    setForm(undefined);
    await load();
  };

  const handleLinkUnlinked = async (userId: string) => {
    const facilityId = linkChoice[userId];
    if (!facilityId) return;
    setLinkingId(userId);
    setLinkError('');
    try {
      await linkStaff(facilityId, unlinked.find((s) => s.id === userId)?.email ?? '');
      setNotice('Staff member linked to the facility.');
      await load();
    } catch (err) {
      setLinkError(getApiErrorMessage(err, 'Could not link that staff member.'));
    } finally {
      setLinkingId(null);
    }
  };

  const facilities = overview?.facilities ?? [];
  const filtered = facilities.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardShell roleLabel="Admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Facilities</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage the facilities that receive referrals, their specialties, and their staff.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/admin/reports" className={secondaryButtonLink}>
              Medical Reports
            </Link>
            <Link to="/admin/vaccination" className={secondaryButtonLink}>
              Vaccination Tracker
            </Link>
            <Button onClick={() => setForm(null)}>+ Add Facility</Button>
          </div>
        </div>

        {notice && (
          <div role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
            {notice}
          </div>
        )}

        {facilities.length > 3 && (
          <input
            type="text"
            aria-label="Search facilities by name"
            placeholder="Search facilities by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        )}

        {loading && (
          <div className="grid lg:grid-cols-2 gap-5" aria-busy="true">
            <span className="sr-only">Loading facilities…</span>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && error && <ErrorBlock message={error} onRetry={load} />}

        {!loading && !error && unlinked.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <h2 className="text-base font-semibold text-slate-900">Hospital staff without a facility</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              These accounts registered before facility codes were introduced. Link them to the
              right facility so they can receive referrals and vaccination access.
            </p>
            <ul className="mt-3 divide-y divide-amber-200/70 rounded-lg border border-amber-200 bg-white">
              {unlinked.map((person) => (
                <li key={person.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="truncate text-sm text-slate-700">{person.email}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Facility for ${person.email}`}
                      value={linkChoice[person.id] ?? ''}
                      onChange={(e) => setLinkChoice((prev) => ({ ...prev, [person.id]: e.target.value }))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Choose a facility…</option>
                      {facilities.filter((f) => f.isActive).map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      className="!px-3 !py-1.5"
                      disabled={!linkChoice[person.id]}
                      loading={linkingId === person.id}
                      loadingText="Linking…"
                      onClick={() => void handleLinkUnlinked(person.id)}
                    >
                      Link
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {linkError && (
              <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {linkError}
              </p>
            )}
          </section>
        )}

        {!loading && !error && facilities.length === 0 && (
          <EmptyState
            title="No facilities yet"
            description="Add a facility, tag the specialties it offers, then link its hospital staff so they can receive referrals."
            action={<Button onClick={() => setForm(null)}>+ Add Facility</Button>}
          />
        )}

        {!loading && !error && facilities.length > 0 && filtered.length === 0 && (
          <EmptyState title="No facilities match your search" description="Try a different name." />
        )}

        {!loading && !error && filtered.length > 0 && overview && (
          <div className="grid lg:grid-cols-2 gap-5">
            {filtered.map((f) => (
              <AdminFacilityCard
                key={f.id}
                facility={f}
                specialtyOptions={overview.specialtyOptions}
                onChanged={handleChanged}
                onEdit={() => setForm(f)}
              />
            ))}
          </div>
        )}
      </div>

      {newCode && (
        <RegistrationCodeReveal
          facilityName={newCode.facilityName}
          issued={newCode.issued}
          onClose={() => setNewCode(null)}
        />
      )}

      {form !== undefined && (
        <FacilityFormModal
          facility={form ?? undefined}
          onSubmit={handleFormSubmit}
          onClose={() => setForm(undefined)}
        />
      )}
    </DashboardShell>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<AdminFacilitiesHome />} />
      <Route
        path="vaccination/*"
        element={
          <VaccinationModule
            role="ADMIN"
            basePath="/admin/vaccination"
            dashboardPath="/admin"
          />
        }
      />
      <Route
        path="reports/*"
        element={<ReportModule role="ADMIN" basePath="/admin/reports" />}
      />
    </Routes>
  );
}
import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { fetchLinkedPatients } from '../../api/helpers';
import type { Patient } from '../../types/patient';
import { calculateAge } from '../../utils/age';
import { useAssistedPatient } from '../../context/AssistedPatientContext';
import RegisterPatientForm from './RegisterPatientForm';
import DashboardShell from '../../components/layout/DashboardShell';
import ServicesSection, {
  PLANNED_SERVICES,
  REFERRAL_SERVICE,
} from '../../components/dashboard/ServicesSection';
import MyReferralsSection from '../../components/referral/MyReferralsSection';
import type { ServiceItem } from '../../components/dashboard/ServicesSection';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import { primaryButtonLink, secondaryButtonLink } from '../../components/ui/buttonLink';
import AssessmentPage from '../patient/assessment/AssessmentPage';
import RecommendedFacilitiesPage from '../shared/RecommendedFacilitiesPage';
import VaccinationModule from '../vaccination/VaccinationModule';

const initials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatGender = (g: string) => g.charAt(0) + g.slice(1).toLowerCase();

function PatientSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-3 w-1/2 rounded bg-slate-100 mt-4" />
      <div className="h-9 rounded-md bg-slate-100 mt-4" />
    </div>
  );
}

function HelperDashboardHome() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const { assistedPatient, setAssistedPatient } = useAssistedPatient();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setPatients(await fetchLinkedPatients());
    } catch {
      setError('Could not load your patients. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone && p.phone.includes(search))
  );

  const services: ServiceItem[] = [
    {
      key: 'assessment',
      title: 'Symptom Assessment & Triage',
      description: 'Run a symptom assessment for a linked patient and review the screening result.',
      status: 'available',
      footer: assistedPatient ? (
        <Link to="/helper/assessment/new" className={primaryButtonLink}>
          Start for {assistedPatient.fullName}
        </Link>
      ) : (
        <p className="text-xs text-slate-500">
          Choose “Assist Patient” on a patient above to begin.
        </p>
      ),
    },
    REFERRAL_SERVICE,
    {
      key: 'vaccination',
      title: 'Vaccination Tracker',
      description: 'Register children, record doses, and see who is due or overdue.',
      status: 'available',
      footer: (
        <Link to="/helper/vaccination" className={secondaryButtonLink}>
          Open Tracker
        </Link>
      ),
    },
    ...PLANNED_SERVICES.filter((s) => s.key !== 'vaccination'),
  ];

  return (
    <DashboardShell roleLabel="Helper">
      <div className="space-y-8">
        {/* My Patients — primary section */}
        <section aria-labelledby="patients-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 id="patients-heading" className="text-2xl font-semibold text-slate-900">
                  My Patients
                </h1>
                {!loading && !error && patients.length > 0 && (
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
                    {patients.length}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Patients linked to your account. Choose one to assist with an assessment.
              </p>
            </div>
            <Button onClick={() => setShowRegisterForm(true)}>+ Register Patient</Button>
          </div>

          {assistedPatient && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                  {initials(assistedPatient.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-blue-700">Currently assisting</p>
                  <p className="text-sm font-semibold text-blue-950 truncate">
                    {assistedPatient.fullName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/helper/assessment/new" className={primaryButtonLink}>
                  Start Assessment
                </Link>
                <button
                  onClick={() => setAssistedPatient(null)}
                  className="text-sm text-blue-700 hover:text-blue-900 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Stop assisting
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="text"
              aria-label="Search patients by name or mobile number"
              placeholder="Search by name or mobile number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {!loading && !error && patients.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Showing {filtered.length} of {patients.length}
            </p>
          )}

          <div className="mt-5">
            {loading && (
              <div
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                aria-busy="true"
                aria-live="polite"
              >
                <span className="sr-only">Loading your patients…</span>
                <PatientSkeleton />
                <PatientSkeleton />
                <PatientSkeleton />
              </div>
            )}

            {!loading && error && (
              <Card>
                <ErrorBlock message={error} onRetry={load} />
              </Card>
            )}

            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                title={
                  patients.length === 0 ? 'No patients linked yet' : 'No patients match your search'
                }
                description={
                  patients.length === 0
                    ? 'Register a new patient to start assisting them.'
                    : 'Try a different name or mobile number.'
                }
                action={
                  patients.length === 0 ? (
                    <Button onClick={() => setShowRegisterForm(true)}>+ Register Patient</Button>
                  ) : undefined
                }
              />
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((patient) => {
                  const isActive = assistedPatient?.id === patient.id;
                  return (
                    <article
                      key={patient.id}
                      className={`flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm transition ${
                        isActive
                          ? 'border-blue-400 ring-2 ring-blue-100'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                          {initials(patient.fullName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-slate-900 truncate">{patient.fullName}</h3>
                          <p className="text-xs text-slate-500">
                            {calculateAge(patient.dateOfBirth)} yrs · {formatGender(patient.gender)}
                          </p>
                        </div>
                        {isActive && (
                          <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                            Assisting
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 shrink-0 text-slate-400"
                          aria-hidden="true"
                        >
                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                        </svg>
                        {patient.phone ? (
                          <span className="text-slate-600">{patient.phone}</span>
                        ) : (
                          <span className="text-slate-400">No phone on file</span>
                        )}
                      </div>

                      <Button
                        variant={isActive ? 'secondary' : 'primary'}
                        className="w-full mt-auto"
                        onClick={() => setAssistedPatient(patient)}
                        disabled={isActive}
                      >
                        {isActive ? 'Currently Assisting' : 'Assist Patient'}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <MyReferralsSection basePath="/helper" showPatientName />

        <ServicesSection services={services} />
      </div>

      {showRegisterForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Register patient"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
        >
          <RegisterPatientForm
            onCancel={() => setShowRegisterForm(false)}
            onSuccess={(patient) => {
              setPatients((prev) => [...prev, patient]);
              setShowRegisterForm(false);
            }}
          />
        </div>
      )}
    </DashboardShell>
  );
}

export default function HelperDashboard() {
  return (
    <Routes>
      <Route index element={<HelperDashboardHome />} />
      <Route path="assessment/new" element={<AssessmentPage />} />
      <Route
        path="assessment/:assessmentId/recommendations"
        element={<RecommendedFacilitiesPage backTo="/helper" />}
      />
      <Route
        path="vaccination/*"
        element={
          <VaccinationModule
            role="HELPER"
            basePath="/helper/vaccination"
            dashboardPath="/helper"
          />
        }
      />
    </Routes>
  );
}
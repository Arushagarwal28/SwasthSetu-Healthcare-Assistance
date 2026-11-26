import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';

import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../auth/AuthContext';

import AssessmentPage from './assessment/AssessmentPage';
import PatientHomeLayout from './PatientHomeLayout';

import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import ErrorBlock from '../../components/ui/ErrorBlock';
import RecommendedFacilitiesPage from '../shared/RecommendedFacilitiesPage';
import ReportModule from '../../modules/reports/ReportModule';

interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone?: string | null;
  address?: string | null;
}

const initials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatGender = (gender: string) =>
  gender.charAt(0).toUpperCase() +
  gender.slice(1).toLowerCase();

function ProfileCard({
  patient,
  email,
}: {
  patient: Patient;
  email?: string;
}) {
  const formattedDateOfBirth = new Date(
    patient.dateOfBirth,
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows: { label: string; value: string }[] = [
    {
      label: 'Email',
      value: email || '—',
    },
    {
      label: 'Date of birth',
      value: formattedDateOfBirth,
    },
    {
      label: 'Gender',
      value: formatGender(patient.gender),
    },
  ];

  if (patient.phone) {
    rows.push({
      label: 'Phone',
      value: patient.phone,
    });
  }

  return (
    <Card
      title="Your Profile"
      action={
        <Link
          to="/patient/profile"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Edit
        </Link>
      }
    >
      {/* Patient identity */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold">
          {initials(patient.fullName)}
        </span>

        <p className="font-medium text-slate-900 break-words">
          {patient.fullName}
        </p>
      </div>

      {/* Profile details */}
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-4 py-3"
          >
            <dt className="text-slate-500">
              {row.label}
            </dt>

            <dd className="text-right text-slate-900 break-words min-w-0">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await axiosClient.get('/patients/me');

        setPatient(response.data.data);
      } catch (error: any) {
        /*
         * Preserve existing behavior:
         * If the patient has not created their profile yet,
         * redirect them to the profile creation page.
         */
        if (error.response?.status === 404) {
          navigate('/patient/profile', {
            replace: true,
          });
          return;
        }

        console.error(
          'PATIENT PROFILE ERROR:',
          error,
        );

        setError('Unable to load your profile.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  /* Loading state */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner label="Loading your dashboard…" />
      </div>
    );
  }

  /* Error state */
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <ErrorBlock
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  /*
   * This should only happen if the component reaches this point
   * without a patient object.
   */
  if (!patient) {
    return null;
  }

  return (
    <PatientHomeLayout
      name={patient.fullName}
      profile={
        <ProfileCard
          patient={patient}
          email={user?.email}
        />
      }
    />
  );
}

export default function PatientDashboard() {
  return (
    <Routes>
      {/* Main patient dashboard */}
      <Route
        index
        element={<DashboardHome />}
      />

      {/* Existing assessment flow */}
      <Route
        path="assessment/new"
        element={<AssessmentPage />}
      />
      <Route
        path="assessment/:assessmentId/recommendations"
        element={<RecommendedFacilitiesPage backTo="/patient" />}
      />

      {/* Medical Report Simplifier */}
      <Route
        path="reports/*"
        element={<ReportModule role="PATIENT" basePath="/patient/reports" />}
      />
    </Routes>
  );
}
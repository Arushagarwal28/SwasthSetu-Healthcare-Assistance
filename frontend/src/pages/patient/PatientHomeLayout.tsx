import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../../components/layout/DashboardShell';
import WelcomeBanner from '../../components/dashboard/WelcomeBanner';
import ServicesSection, {
  PLANNED_SERVICES,
  REFERRAL_SERVICE,
  medicalReportServiceItem,
} from '../../components/dashboard/ServicesSection';
import MyReferralsSection from '../../components/referral/MyReferralsSection';
import type { ServiceItem } from '../../components/dashboard/ServicesSection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { primaryButtonLink } from '../../components/ui/buttonLink';

interface Props {
  /** Patient's name for the welcome message, if you have it. */
  name?: string;
  /** Your EXISTING profile card (with Edit), rendered unchanged. */
  profile: ReactNode;
  /** Pass false while the profile isn't created yet. Defaults to true. */
  canStartAssessment?: boolean;
  /** Shown under a disabled Start Assessment button. */
  assessmentHint?: string;
}

const STEPS = [
  'Select your symptoms',
  'Add severity and duration',
  'Answer follow-up questions if needed',
  'Review your screening result',
];

export default function PatientHomeLayout({
  name,
  profile,
  canStartAssessment = true,
  assessmentHint = 'Complete your profile to start an assessment.',
}: Props) {
  const startAction = canStartAssessment ? (
    <Link to="/patient/assessment/new" className={primaryButtonLink}>
      Start Assessment
    </Link>
  ) : (
    <div>
      <Button disabled>Start Assessment</Button>
      <p className="text-xs text-slate-500 mt-2">{assessmentHint}</p>
    </div>
  );

  const services: ServiceItem[] = [
    {
      key: 'assessment',
      title: 'Health Assessment & Triage',
      description: 'Check your symptoms and get a model-based screening suggestion.',
      status: 'available',
      footer: startAction,
    },
    REFERRAL_SERVICE,
    medicalReportServiceItem('/patient/reports'),
    ...PLANNED_SERVICES.filter((service) => service.key !== 'report'),
  ];

  return (
    <DashboardShell roleLabel="Patient">
      <div className="space-y-8">
        <WelcomeBanner
          name={name}
          subtitle="Check your symptoms, review your screening result, and keep your profile up to date."
        />

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div>{profile}</div>

          <Card
            title="Health Assessment"
            description="A short guided check of your symptoms."
          >
            <ol className="space-y-2.5 mb-5">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500 mb-4">
              The result is a model-based screening suggestion, not a medical diagnosis.
            </p>
            {startAction}
          </Card>
        </div>

        <MyReferralsSection basePath="/patient" />

        <ServicesSection services={services} />
      </div>
    </DashboardShell>
  );
}
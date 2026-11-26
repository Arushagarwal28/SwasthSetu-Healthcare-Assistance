import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ServiceIcon from './ServiceIcon';
import type { ServiceIconName } from './ServiceIcon';
import { primaryButtonLink } from '../ui/buttonLink';

export interface ServiceItem {
  key: ServiceIconName;
  title: string;
  description: string;
  status: 'available' | 'soon';
  /** Rendered at the bottom of the card. Only used for features that exist. */
  footer?: ReactNode;
}

export const PLANNED_SERVICES: ServiceItem[] = [
  {
    key: 'report',
    title: 'Medical Report Simplifier',
    description: 'Turn medical reports into plain-language summaries.',
    status: 'soon',
  },
  {
    key: 'assistant',
    title: 'AI Health Assistant',
    description: 'Ask health questions in a simple conversational interface.',
    status: 'soon',
  },
];

export const REFERRAL_SERVICE: ServiceItem = {
  key: 'referral',
  title: 'Hospital / Facility Referral',
  description: 'Refer a patient to a suitable facility and follow the hospital’s response.',
  status: 'available',
  footer: (
    <p className="text-xs text-slate-500">
      Start from the result of a completed assessment.
    </p>
  ),
};

/**
 * The Medical Report Simplifier is available to patients, helpers, hospital
 * staff (shared reports only) and admins (aggregates only). Pass the base path
 * that matches the current user.
 */
export const medicalReportServiceItem = (basePath: string): ServiceItem => ({
  key: 'report',
  title: 'Medical Report Simplifier',
  description:
    'Upload a printed report and read a plain-language explanation in English or Hindi.',
  status: 'available',
  footer: (
    <Link to={basePath} className={primaryButtonLink}>
      Open Medical Reports
    </Link>
  ),
});

/**
 * The vaccination tracker is available for helpers, hospital staff and admins,
 * each under their own base path. Pass the one that matches the current user.
 */
export const vaccinationServiceItem = (basePath: string): ServiceItem => ({
  key: 'vaccination',
  title: 'Vaccination Tracker',
  description: 'Register children, record doses, and see who is due or overdue.',
  status: 'available',
  footer: (
    <Link to={basePath} className={primaryButtonLink}>
      Open Vaccination Tracker
    </Link>
  ),
});

export default function ServicesSection({ services }: { services: ServiceItem[] }) {
  return (
    <section aria-labelledby="services-heading">
      <div className="mb-4">
        <h2 id="services-heading" className="text-lg font-semibold text-slate-900">
          Healthcare Services
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Health assessment, referrals, medical reports and the vaccination tracker are available
          now. The other modules are planned.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((s) => {
          const available = s.status === 'available';
          return (
            <article
              key={s.key}
              className={`flex flex-col rounded-xl bg-white p-5 border ${
                available ? 'border-slate-200 shadow-sm' : 'border-dashed border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    available ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <ServiceIcon name={s.key} />
                </span>
                <span
                  className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 border ${
                    available
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-slate-600 bg-slate-50 border-slate-200'
                  }`}
                >
                  {available ? 'Available' : 'Coming soon'}
                </span>
              </div>
              <h3 className={`mt-4 font-medium ${available ? 'text-slate-900' : 'text-slate-700'}`}>
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{s.description}</p>
              {s.footer && <div className="mt-auto pt-4">{s.footer}</div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
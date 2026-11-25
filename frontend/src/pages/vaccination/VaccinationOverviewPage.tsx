import { Link } from 'react-router-dom';
import type { VaccinationRole } from '../../types/vaccination';

interface Props {
  role: VaccinationRole;
  basePath: string;
}

interface OverviewSection {
  title: string;
  description: string;
  phase: string;
  /** Omitted when the section has no route of its own yet. */
  to?: string;
}

const STAFF_SECTIONS: OverviewSection[] = [
  {
    title: 'Registered children',
    description: 'Register a child and their historical doses, then find them again quickly.',
    phase: 'Phase 3',
    to: 'children',
  },
  {
    title: 'Child vaccination record',
    description: 'Progress, overdue and upcoming doses, the next visit, and dose actions.',
    phase: 'Phases 4–5',
  },
  {
    title: 'Vaccination worklist',
    description: 'Everyone overdue, due today, and coming up in the next few days.',
    phase: 'Phase 6',
    to: 'worklist',
  },
  {
    title: 'Notifications',
    description: 'In-app reminders for the children in your scope.',
    phase: 'Phase 7',
    to: 'notifications',
  },
  {
    title: 'Vaccination centres',
    description: 'Find a facility that offers the vaccine a child needs next.',
    phase: 'Phase 8',
    to: 'centres',
  },
];

const ADMIN_SECTIONS: OverviewSection[] = [
  {
    title: 'Aggregate statistics',
    description: 'Children registered, doses given, overdue and due in the next seven days, coverage by vaccine.',
    phase: 'Phase 9',
  },
  {
    title: 'Vaccines and dose schedule',
    description: 'The vaccine catalogue and the UIP schedule new children are registered against.',
    phase: 'Phase 10',
    to: 'vaccines',
  },
  {
    title: 'Vaccination centres',
    description: 'Which facilities offer which vaccines, and their district and PIN code.',
    phase: 'Phase 8',
    to: 'centres',
  },
];

const ACCESS_NOTE: Record<VaccinationRole, string[]> = {
  HELPER: [
    'You see children you registered yourself.',
    'Another helper’s children are not listed, and opening one returns “not found”.',
    'Assessments and referrals are unchanged by this module.',
  ],
  HOSPITAL_STAFF: [
    'You see children assigned to a facility you are linked to.',
    'A child is only visible once a facility is assigned at registration.',
    'Recording a dose at a facility requires being linked to that facility.',
  ],
  ADMIN: [
    'You see aggregate counts only: no child names, mobiles or individual records.',
    'You can manage the vaccine catalogue, the dose schedule and centre configuration.',
    'Children’s medical records remain restricted to helpers and hospital staff by design.',
  ],
};

export default function VaccinationOverviewPage({ role, basePath }: Props) {
  const sections = role === 'ADMIN' ? ADMIN_SECTIONS : STAFF_SECTIONS;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-blue-950">What you can access</h2>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-blue-900">
          {ACCESS_NOTE[role].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="vaccination-sections-heading">
        <div className="mb-4">
          <h2 id="vaccination-sections-heading" className="text-lg font-semibold text-slate-900">
            Sections
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            The module is being completed section by section; the phase that adds each one is shown
            on its card.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-900">{section.title}</h3>
                  <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {section.phase}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {section.description}
                </p>
              </>
            );

            return section.to ? (
              <Link
                key={section.title}
                to={`${basePath}/${section.to}`}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {body}
                <span className="mt-3 text-xs font-medium text-blue-700">Open section</span>
              </Link>
            ) : (
              <article
                key={section.title}
                className="flex flex-col rounded-xl border border-dashed border-slate-300 bg-white p-5"
              >
                {body}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
import Card from '../ui/Card';
import type { fetchChildProfile } from '../../api/vaccination';
import type { ChildDashboard } from '../../types/vaccination';

type ChildProfileData = Awaited<ReturnType<typeof fetchChildProfile>>;

interface ChildDetailsCardProps {
  child: ChildDashboard['child'];
  profile: ChildProfileData | null;
}

interface Row {
  label: string;
  value: string | null;
}

const capitalise = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase();

export default function ChildDetailsCard({ child, profile }: ChildDetailsCardProps) {
  const rows: Row[] = [
    { label: 'Record number', value: child.recordNumber },
    { label: 'Date of birth', value: child.dateOfBirth },
    { label: 'Age', value: child.age },
    { label: 'Gender', value: capitalise(child.gender) },
    { label: 'Village', value: child.village },
    { label: 'District', value: child.district },
    { label: 'Facility', value: child.assignedFacility?.name ?? null },
    { label: 'JE endemic area', value: child.jeEndemicArea ? 'Yes' : 'No' },
    { label: 'Preferred language', value: child.preferredLanguage === 'HI' ? 'Hindi' : 'English' },
    { label: 'SMS reminders', value: child.smsConsent ? 'Consented' : 'Not consented' },
  ];

  if (profile) {
    rows.push(
      { label: 'Mother', value: profile.motherName ?? null },
      { label: 'Father', value: profile.fatherName ?? null },
      { label: 'Guardian', value: profile.guardianName ?? null },
      { label: 'Primary mobile', value: profile.primaryMobile },
      { label: 'Alternate mobile', value: profile.alternateMobile ?? null },
      { label: 'Address', value: profile.addressLine ?? null },
      { label: 'PIN code', value: profile.pinCode ?? null }
    );
  }

  return (
    <Card title="Child details">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.label}</dt>
            <dd className="text-sm text-slate-900">{row.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
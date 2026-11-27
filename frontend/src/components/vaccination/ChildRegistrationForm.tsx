import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  describeChildRegistrationError,
  fetchMyFacilities,
  fetchVaccineSchedule,
  registerChild,
} from '../../api/vaccination';
import type {
  ChildGender,
  ChildProfile,
  DuplicateChildMatch,
  HistoricalDoseInput,
  MyFacility,
  PreferredLanguage,
  RegisterChildInput,
  VaccineScheduleView,
} from '../../types/vaccination';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TextField from '../auth/TextField';
import DuplicateChildDialog from './DuplicateChildDialog';

interface Props {
  basePath: string;
  onRegistered: (child: ChildProfile) => void;
  onCancel: () => void;
}

interface FormState {
  fullName: string;
  dateOfBirth: string;
  gender: ChildGender | '';
  birthWeightGrams: string;
  motherName: string;
  fatherName: string;
  guardianName: string;
  primaryMobile: string;
  alternateMobile: string;
  email: string;
  addressLine: string;
  village: string;
  district: string;
  state: string;
  pinCode: string;
  latitude: string;
  longitude: string;
  jeEndemicArea: boolean;
  preferredLanguage: PreferredLanguage;
  smsConsent: boolean;
  /** The facility of this registration encounter; never stored on the child. */
  operatingFacilityId: string;
  guardianConsent: boolean;
}

interface HistoryRow {
  key: string;
  /** `${vaccineCode}::${doseNumber}` — the value of the schedule <select>. */
  entry: string;
  administeredOn: string;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  dateOfBirth: '',
  gender: '',
  birthWeightGrams: '',
  motherName: '',
  fatherName: '',
  guardianName: '',
  primaryMobile: '',
  alternateMobile: '',
  email: '',
  addressLine: '',
  village: '',
  district: '',
  state: '',
  pinCode: '',
  latitude: '',
  longitude: '',
  jeEndemicArea: false,
  preferredLanguage: 'EN',
  smsConsent: false,
  operatingFacilityId: '',
  guardianConsent: false,
};

const GENDER_OPTIONS: { value: ChildGender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const MOBILE = /^[6-9]\d{9}$/;
const PIN_CODE = /^[1-9]\d{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

/** Same normalisation the backend applies: +91, a leading 0 and separators are removed. */
const normalizeMobile = (value: string) =>
  value.replace(/[\s\-()]/g, '').replace(/^(?:\+91|91|0)(?=\d{10}$)/, '');

const todayYmd = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const isYmd = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

let historyRowSequence = 0;
const newHistoryRow = (): HistoryRow => {
  historyRowSequence += 1;
  return { key: `history-row-${historyRowSequence}`, entry: '', administeredOn: '' };
};

const validateForm = (
  form: FormState,
  history: HistoryRow[],
  today: string,
  facilityCount: number
): Record<string, string> => {
  const errors: Record<string, string> = {};
  const fullName = form.fullName.trim();

  if (!fullName) errors.fullName = 'Child name is required';
  else if (fullName.length > 100) errors.fullName = 'Child name must be at most 100 characters';

  if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
  else if (!isYmd(form.dateOfBirth)) errors.dateOfBirth = 'Enter a real date in YYYY-MM-DD format';
  else if (form.dateOfBirth > today) errors.dateOfBirth = 'Date of birth cannot be in the future';

  if (!form.gender) errors.gender = 'Choose the child’s gender';

  if (form.birthWeightGrams.trim() !== '') {
    const weight = Number(form.birthWeightGrams);
    if (!Number.isInteger(weight) || weight < 300 || weight > 7000) {
      errors.birthWeightGrams = 'Birth weight must be a whole number between 300 and 7000 grams';
    }
  }

  if (!form.motherName.trim()) errors.motherName = 'Mother’s name is required';
  else if (form.motherName.trim().length > 100) {
    errors.motherName = 'Mother’s name must be at most 100 characters';
  }

  if (!form.fatherName.trim()) errors.fatherName = 'Father’s name is required';
  else if (form.fatherName.trim().length > 100) {
    errors.fatherName = 'Father’s name must be at most 100 characters';
  }

  const primaryMobile = normalizeMobile(form.primaryMobile);
  if (!primaryMobile) errors.primaryMobile = 'Primary mobile number is required';
  else if (!MOBILE.test(primaryMobile)) {
    errors.primaryMobile = 'Enter a valid 10-digit Indian mobile number';
  }

  const alternateMobile = normalizeMobile(form.alternateMobile);
  if (alternateMobile && !MOBILE.test(alternateMobile)) {
    errors.alternateMobile = 'Enter a valid 10-digit Indian mobile number';
  } else if (alternateMobile && alternateMobile === primaryMobile) {
    errors.alternateMobile = 'The alternate number must differ from the primary number';
  }

  if (form.email.trim() && !EMAIL.test(form.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (!form.addressLine.trim()) errors.addressLine = 'Address is required';
  else if (form.addressLine.trim().length > 200) {
    errors.addressLine = 'Address must be at most 200 characters';
  }

  if (!form.village.trim()) errors.village = 'Village / town is required';
  if (!form.district.trim()) errors.district = 'District is required';
  if (!form.state.trim()) errors.state = 'State is required';
  if (!PIN_CODE.test(form.pinCode.trim())) errors.pinCode = 'Enter a valid 6-digit PIN code';

  if (facilityCount > 1 && !form.operatingFacilityId) {
    errors.operatingFacilityId = 'Choose the facility where you are registering this child';
  }

  if (!form.guardianConsent) {
    errors.guardianConsent = 'Confirm that the guardian consents to this vaccination record';
  }

  const latitude = form.latitude.trim();
  const longitude = form.longitude.trim();
  if ((latitude === '') !== (longitude === '')) {
    errors.latitude = 'Enter both latitude and longitude, or leave both empty';
  } else if (latitude !== '' && longitude !== '') {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
    }
  }

  history.forEach((row) => {
    const key = `history-${row.key}`;
    if (!row.entry) errors[key] = 'Choose which vaccine and dose was given';
    else if (!row.administeredOn) errors[key] = 'Enter the date this dose was given';
    else if (!isYmd(row.administeredOn)) errors[key] = 'Enter a real date in YYYY-MM-DD format';
    else if (row.administeredOn > today) errors[key] = 'The date cannot be in the future';
    else if (form.dateOfBirth && row.administeredOn < form.dateOfBirth) {
      errors[key] = 'The date cannot be before the date of birth';
    }
  });

  return errors;
};

const buildPayload = (
  form: FormState,
  history: HistoryRow[],
  confirmDuplicate: boolean
): RegisterChildInput => {
  const optional = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  };

  // Validation has already guaranteed a gender is chosen.
  const gender: ChildGender = form.gender === '' ? 'OTHER' : form.gender;

  const historyRows: HistoricalDoseInput[] = history
    .filter((row) => row.entry !== '' && row.administeredOn !== '')
    .map((row) => {
      const parts = row.entry.split('::');
      return {
        vaccineCode: (parts[0] ?? '').toUpperCase(),
        doseNumber: Number(parts[1] ?? 0),
        administeredOn: row.administeredOn,
      };
    });

  return {
    fullName: form.fullName.trim(),
    dateOfBirth: form.dateOfBirth,
    gender,
    birthWeightGrams: optional(form.birthWeightGrams)
      ? Number(form.birthWeightGrams)
      : undefined,
    motherName: form.motherName.trim(),
    fatherName: form.fatherName.trim(),
    guardianName: optional(form.guardianName),
    primaryMobile: normalizeMobile(form.primaryMobile),
    alternateMobile: optional(normalizeMobile(form.alternateMobile)),
    email: optional(form.email),
    addressLine: form.addressLine.trim(),
    village: form.village.trim(),
    district: form.district.trim(),
    state: form.state.trim(),
    pinCode: form.pinCode.trim(),
    latitude: optional(form.latitude) ? Number(form.latitude) : undefined,
    longitude: optional(form.longitude) ? Number(form.longitude) : undefined,
    jeEndemicArea: form.jeEndemicArea,
    preferredLanguage: form.preferredLanguage,
    smsConsent: form.smsConsent,
    operatingFacilityId: optional(form.operatingFacilityId),
    guardianConsentConfirmed: form.guardianConsent,
    confirmDuplicate: confirmDuplicate || undefined,
    history: historyRows.length > 0 ? historyRows : undefined,
  };
};

function CheckboxRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-lg p-1 -m-1 focus-within:ring-2 focus-within:ring-blue-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
      </span>
    </label>
  );
}

export default function ChildRegistrationForm({ basePath, onRegistered, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<{
    message: string;
    matches: DuplicateChildMatch[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [facilities, setFacilities] = useState<MyFacility[]>([]);
  const [facilityLoadFailed, setFacilityLoadFailed] = useState(false);
  const [schedule, setSchedule] = useState<VaccineScheduleView[]>([]);
  const [scheduleState, setScheduleState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');

  const today = useMemo(todayYmd, []);

  useEffect(() => {
    let cancelled = false;
    // Only the facilities this account is linked to can be the operating
    // facility. Helpers without a facility link simply get no selector; the
    // backend still records the registration.
    fetchMyFacilities()
      .then((rows) => {
        if (!cancelled) setFacilities(rows.filter((row) => row.isActive));
      })
      .catch(() => {
        if (!cancelled) setFacilityLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSchedule = useCallback(() => {
    setScheduleState('loading');
    fetchVaccineSchedule()
      .then((rows) => {
        setSchedule(rows);
        setScheduleState('ready');
      })
      .catch(() => setScheduleState('failed'));
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const facilityOptions = useMemo(
    () => [...facilities].sort((a, b) => a.name.localeCompare(b.name)),
    [facilities]
  );

  const scheduleOptions = useMemo(
    () =>
      schedule.flatMap((vaccine) =>
        vaccine.scheduleEntries.map((entry) => ({
          value: `${vaccine.code}::${entry.doseNumber}`,
          label: `${vaccine.code} · ${entry.doseLabel} (${entry.ageLabel})`,
        }))
      ),
    [schedule]
  );

  const addHistoryRow = () => setHistory((prev) => [...prev, newHistoryRow()]);

  const updateHistoryRow = (key: string, patch: Partial<HistoryRow>) => {
    setHistory((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors((prev) => {
      const errorKey = `history-${key}`;
      if (!prev[errorKey]) return prev;
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });
  };

  const removeHistoryRow = (key: string) => {
    setHistory((prev) => prev.filter((row) => row.key !== key));
    setErrors((prev) => {
      const errorKey = `history-${key}`;
      if (!prev[errorKey]) return prev;
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMsg('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationMsg('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocationMsg('Could not get the location. Enter the coordinates manually.');
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const submit = async (confirmDuplicate: boolean) => {
    const found = validateForm(form, history, today, facilityOptions.length);
    setErrors(found);
    setApiErrors([]);

    if (Object.keys(found).length > 0) {
      setDuplicates(null);
      return;
    }

    setSubmitting(true);
    try {
      const child = await registerChild(buildPayload(form, history, confirmDuplicate));
      onRegistered(child);
    } catch (err) {
      const failure = describeChildRegistrationError(err);
      setDuplicates(null);
      if (failure.kind === 'DUPLICATES') {
        setDuplicates({ message: failure.message, matches: failure.matches });
      } else if (failure.kind === 'INVALID') {
        setApiErrors(failure.errors);
      } else {
        setApiErrors([failure.message]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(false);
  };

  const allOptionsUsed =
    scheduleOptions.length > 0 && history.filter((row) => row.entry !== '').length >= scheduleOptions.length;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Card title="Child details" description="The date of birth, gender and JE flag decide the whole schedule.">
          <div className="space-y-4">
            <TextField
              label="Child’s full name"
              value={form.fullName}
              maxLength={100}
              onChange={(event) => setField('fullName', event.target.value)}
              error={errors.fullName}
              autoFocus
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Date of birth"
                type="date"
                max={today}
                value={form.dateOfBirth}
                onChange={(event) => setField('dateOfBirth', event.target.value)}
                error={errors.dateOfBirth}
              />
              <TextField
                label="Birth weight (grams)"
                inputMode="numeric"
                placeholder="Optional"
                value={form.birthWeightGrams}
                onChange={(event) => setField('birthWeightGrams', event.target.value)}
                error={errors.birthWeightGrams}
                hint="Between 300 and 7000 g. Leave blank if unknown."
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Gender</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Gender">
                {GENDER_OPTIONS.map((option) => {
                  const active = form.gender === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-200 ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={active}
                        onChange={() => setField('gender', option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              {errors.gender && <p className="text-xs text-red-600 mt-1.5">{errors.gender}</p>}
            </div>
          </div>
        </Card>

        <Card title="Parents, guardian and contact">
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Mother’s name"
                value={form.motherName}
                maxLength={100}
                onChange={(event) => setField('motherName', event.target.value)}
                error={errors.motherName}
              />
              <TextField
                label="Father’s name"
                value={form.fatherName}
                maxLength={100}
                onChange={(event) => setField('fatherName', event.target.value)}
                error={errors.fatherName}
              />
            </div>

            <TextField
              label="Guardian’s name"
              placeholder="Optional"
              value={form.guardianName}
              maxLength={100}
              onChange={(event) => setField('guardianName', event.target.value)}
              error={errors.guardianName}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Primary mobile number"
                type="tel"
                inputMode="tel"
                value={form.primaryMobile}
                onChange={(event) => setField('primaryMobile', event.target.value)}
                error={errors.primaryMobile}
                hint="10-digit mobile number. +91 and a leading 0 are removed automatically."
              />
              <TextField
                label="Alternate mobile number"
                type="tel"
                inputMode="tel"
                placeholder="Optional"
                value={form.alternateMobile}
                onChange={(event) => setField('alternateMobile', event.target.value)}
                error={errors.alternateMobile}
              />
            </div>

            <TextField
              label="Email"
              type="email"
              placeholder="Optional"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              error={errors.email}
            />
          </div>
        </Card>

        <Card title="Address">
          <div className="space-y-4">
            <TextField
              label="Address"
              value={form.addressLine}
              maxLength={200}
              onChange={(event) => setField('addressLine', event.target.value)}
              error={errors.addressLine}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Village / town"
                value={form.village}
                maxLength={100}
                onChange={(event) => setField('village', event.target.value)}
                error={errors.village}
              />
              <TextField
                label="District"
                value={form.district}
                maxLength={100}
                onChange={(event) => setField('district', event.target.value)}
                error={errors.district}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="State"
                value={form.state}
                maxLength={100}
                onChange={(event) => setField('state', event.target.value)}
                error={errors.state}
              />
              <TextField
                label="PIN code"
                inputMode="numeric"
                maxLength={6}
                value={form.pinCode}
                onChange={(event) => setField('pinCode', event.target.value)}
                error={errors.pinCode}
              />
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 mb-1.5">
                Location (optional)
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Latitude"
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) => setField('latitude', event.target.value)}
                  error={errors.latitude}
                />
                <TextField
                  label="Longitude"
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) => setField('longitude', event.target.value)}
                  error={errors.longitude}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1.5 !px-3"
                  onClick={useMyLocation}
                  loading={locating}
                  loadingText="Locating…"
                >
                  Use my current location
                </Button>
                <span className="text-xs text-slate-500">
                  Used to suggest the nearest vaccination centres. Without it, the district is used.
                </span>
              </div>
              {locationMsg && <p className="text-xs text-amber-600 mt-2">{locationMsg}</p>}
            </fieldset>
          </div>
        </Card>

        <Card title="Schedule and reminder settings">
          <div className="space-y-4">
            <CheckboxRow
              label="Japanese Encephalitis endemic district"
              description="Tick this if the child lives in a JE endemic district. It adds the JE vaccine to the schedule."
              checked={form.jeEndemicArea}
              onChange={(checked) => setField('jeEndemicArea', checked)}
            />

            <CheckboxRow
              label="Family agrees to SMS reminders"
              description="Dose reminders are sent to the primary mobile number. Consent is recorded with your account."
              checked={form.smsConsent}
              onChange={(checked) => setField('smsConsent', checked)}
            />

            <div>
              <label htmlFor="preferred-language" className="block text-sm font-medium text-slate-700 mb-1.5">
                Reminder language
              </label>
              <select
                id="preferred-language"
                value={form.preferredLanguage}
                onChange={(event) =>
                  setField('preferredLanguage', event.target.value as PreferredLanguage)
                }
                className={SELECT_CLASS}
              >
                <option value="EN">English</option>
                <option value="HI">हिन्दी (Hindi)</option>
              </select>
            </div>

            {facilityOptions.length > 0 && (
              <div>
                <label
                  htmlFor="operating-facility"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Operating facility
                </label>
                <select
                  id="operating-facility"
                  value={form.operatingFacilityId}
                  onChange={(event) => setField('operatingFacilityId', event.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">
                    {facilityOptions.length === 1 ? 'Use my only linked facility' : 'Choose the facility'}
                  </option>
                  {facilityOptions.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  {errors.operatingFacilityId
                    ? errors.operatingFacilityId
                    : 'Where this registration is happening. It is recorded on this encounter, not as the child’s facility.'}
                </p>
                {facilityLoadFailed && (
                  <p className="text-xs text-amber-600 mt-1">
                    The facility list could not be loaded. Your linked facility will be used if the server can
                    determine it.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
              <CheckboxRow
                label="Guardian consents to this vaccination record"
                description="The parent or guardian agrees that this record may be created and used for the child’s vaccination care across facilities."
                checked={form.guardianConsent}
                onChange={(checked) => setField('guardianConsent', checked)}
              />
              {errors.guardianConsent && (
                <p className="text-xs text-red-600 mt-1.5">{errors.guardianConsent}</p>
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Doses already received"
          description="If the child was vaccinated elsewhere, add those doses here so they are not shown as overdue."
        >
          {scheduleState === 'loading' && (
            <p className="text-sm text-slate-500">Loading the vaccination schedule…</p>
          )}

          {scheduleState === 'failed' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <p className="text-sm text-amber-900">
                The vaccination schedule could not be loaded, so past doses cannot be added right now.
              </p>
              <button
                type="button"
                onClick={loadSchedule}
                className="mt-1.5 text-sm text-amber-900 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Try again
              </button>
            </div>
          )}

          {scheduleState === 'ready' && scheduleOptions.length === 0 && (
            <p className="text-sm text-slate-500">
              No doses are configured in the schedule yet, so there is nothing to add.
            </p>
          )}

          {scheduleState === 'ready' && scheduleOptions.length > 0 && (
            <div className="space-y-3">
              {history.length === 0 && (
                <p className="text-sm text-slate-500">No past doses added.</p>
              )}

              {history.map((row, index) => {
                const errorKey = `history-${row.key}`;
                const usedElsewhere = new Set(
                  history.filter((other) => other.key !== row.key).map((other) => other.entry)
                );
                return (
                  <div key={row.key} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="grid sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7">
                        <label
                          htmlFor={`history-entry-${row.key}`}
                          className="block text-sm font-medium text-slate-700 mb-1.5"
                        >
                          Vaccine and dose {index + 1}
                        </label>
                        <select
                          id={`history-entry-${row.key}`}
                          value={row.entry}
                          onChange={(event) => updateHistoryRow(row.key, { entry: event.target.value })}
                          className={SELECT_CLASS}
                        >
                          <option value="">Choose a dose…</option>
                          {scheduleOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={usedElsewhere.has(option.value)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-5">
                        <TextField
                          label="Date given"
                          type="date"
                          max={today}
                          value={row.administeredOn}
                          onChange={(event) =>
                            updateHistoryRow(row.key, { administeredOn: event.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      {errors[errorKey] ? (
                        <p className="text-xs text-red-600">{errors[errorKey]}</p>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => removeHistoryRow(row.key)}
                        className="text-xs text-slate-600 hover:text-red-700 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="secondary"
                onClick={addHistoryRow}
                disabled={allOptionsUsed}
              >
                + Add a dose the child already received
              </Button>
              {allOptionsUsed && (
                <p className="text-xs text-slate-500">Every dose in the schedule has been added.</p>
              )}
            </div>
          )}
        </Card>

        {apiErrors.length > 0 && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">
              {apiErrors.length === 1 ? 'The child could not be registered' : 'These problems must be fixed'}
            </p>
            <ul className="mt-1.5 list-disc list-inside space-y-0.5">
              {apiErrors.map((message) => (
                <li key={message} className="text-sm text-red-700">
                  {message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-200 pt-5">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} loadingText="Registering…">
            Register child
          </Button>
        </div>
      </form>

      {duplicates && (
        <DuplicateChildDialog
          matches={duplicates.matches}
          message={duplicates.message}
          basePath={basePath}
          busy={submitting}
          onRegisterAnyway={() => void submit(true)}
          onClose={() => setDuplicates(null)}
        />
      )}
    </>
  );
}
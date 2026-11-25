import { useCallback, useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/errors';
import {
  createAdminScheduleEntry,
  createAdminVaccine,
  getAdminVaccines,
  runAdminReminders,
  updateAdminScheduleEntry,
  updateAdminVaccine,
  type AdminScheduleEntry,
  type AdminVaccine,
  type ReminderCycleStats,
  type VaccinationAgeUnit,
  type VaccinationApplicability,
} from '../../api/vaccination';

const INPUT =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const PRIMARY =
  'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300';
const SECONDARY =
  'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

const AGE_UNITS: { value: VaccinationAgeUnit; label: string }[] = [
  { value: 'DAYS', label: 'days' },
  { value: 'WEEKS', label: 'weeks' },
  { value: 'MONTHS', label: 'months' },
  { value: 'YEARS', label: 'years' },
];

const APPLICABILITY: { value: VaccinationApplicability; label: string }[] = [
  { value: 'ALWAYS', label: 'All children' },
  { value: 'JE_ENDEMIC_DISTRICT', label: 'JE-endemic districts only' },
  { value: 'FEMALE_ONLY', label: 'Female children only' },
];

const applicabilityLabel = (value: VaccinationApplicability): string =>
  APPLICABILITY.find((a) => a.value === value)?.label ?? value;

interface EntryFormValues {
  doseNumber: string;
  doseLabel: string;
  ageValue: string;
  ageUnit: VaccinationAgeUnit;
  ageLabel: string;
  applicability: VaccinationApplicability;
  sortOrder: string;
  isActive: boolean;
  notes: string;
}

const emptyEntry = (): EntryFormValues => ({
  doseNumber: '',
  doseLabel: '',
  ageValue: '',
  ageUnit: 'WEEKS',
  ageLabel: '',
  applicability: 'ALWAYS',
  sortOrder: '',
  isActive: true,
  notes: '',
});

const entryToValues = (entry: AdminScheduleEntry): EntryFormValues => ({
  doseNumber: String(entry.doseNumber),
  doseLabel: entry.doseLabel,
  ageValue: String(entry.ageValue),
  ageUnit: entry.ageUnit,
  ageLabel: entry.ageLabel,
  applicability: entry.applicability,
  sortOrder: String(entry.sortOrder),
  isActive: entry.isActive,
  notes: entry.notes ?? '',
});

const baseFromValues = (values: EntryFormValues) => ({
  doseLabel: values.doseLabel.trim(),
  ageValue: Number(values.ageValue),
  ageUnit: values.ageUnit,
  ageLabel: values.ageLabel.trim(),
  applicability: values.applicability,
  sortOrder: values.sortOrder.trim() === '' ? undefined : Number(values.sortOrder),
  isActive: values.isActive,
  notes: values.notes.trim() === '' ? null : values.notes.trim(),
});

const validateEntry = (values: EntryFormValues, withDoseNumber: boolean): string | null => {
  if (withDoseNumber) {
    const dose = Number(values.doseNumber);
    if (!Number.isInteger(dose) || dose < 1 || dose > 20) {
      return 'Dose number must be a whole number between 1 and 20.';
    }
  }
  if (values.doseLabel.trim().length < 2 || values.doseLabel.trim().length > 60) {
    return 'Dose label must be 2 to 60 characters.';
  }
  const age = Number(values.ageValue);
  if (!Number.isInteger(age) || age < 0) {
    return 'Age must be a whole number, 0 or more.';
  }
  if (values.ageLabel.trim().length === 0) {
    return 'Age label is required (for example "6 weeks").';
  }
  if (values.sortOrder.trim() !== '') {
    const sort = Number(values.sortOrder);
    if (!Number.isInteger(sort) || sort < 0 || sort > 10000) {
      return 'Sort order must be a whole number between 0 and 10000.';
    }
  }
  return null;
};

function EntryForm({
  values,
  setValues,
  withDoseNumber,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  values: EntryFormValues;
  setValues: (next: EntryFormValues) => void;
  withDoseNumber: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: EntryFormValues) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {withDoseNumber && (
          <div>
            <label className={LABEL} htmlFor="dose-number">
              Dose number
            </label>
            <input
              id="dose-number"
              type="number"
              min={1}
              max={20}
              className={INPUT}
              value={values.doseNumber}
              onChange={(e) => setValues({ ...values, doseNumber: e.target.value })}
            />
          </div>
        )}

        <div>
          <label className={LABEL} htmlFor="dose-label">
            Dose label
          </label>
          <input
            id="dose-label"
            className={INPUT}
            placeholder="e.g. 1st dose"
            value={values.doseLabel}
            onChange={(e) => setValues({ ...values, doseLabel: e.target.value })}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="age-value">
            Age at dose
          </label>
          <div className="flex gap-2">
            <input
              id="age-value"
              type="number"
              min={0}
              className={INPUT}
              value={values.ageValue}
              onChange={(e) => setValues({ ...values, ageValue: e.target.value })}
            />
            <select
              aria-label="Age unit"
              className={INPUT}
              value={values.ageUnit}
              onChange={(e) =>
                setValues({ ...values, ageUnit: e.target.value as VaccinationAgeUnit })
              }
            >
              {AGE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="age-label">
            Age label
          </label>
          <input
            id="age-label"
            className={INPUT}
            placeholder="e.g. 6 weeks"
            value={values.ageLabel}
            onChange={(e) => setValues({ ...values, ageLabel: e.target.value })}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="applicability">
            Applies to
          </label>
          <select
            id="applicability"
            className={INPUT}
            value={values.applicability}
            onChange={(e) =>
              setValues({ ...values, applicability: e.target.value as VaccinationApplicability })
            }
          >
            {APPLICABILITY.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="sort-order">
            Sort order
          </label>
          <input
            id="sort-order"
            type="number"
            min={0}
            className={INPUT}
            placeholder="automatic if blank"
            value={values.sortOrder}
            onChange={(e) => setValues({ ...values, sortOrder: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="entry-notes">
            Notes (optional)
          </label>
          <input
            id="entry-notes"
            className={INPUT}
            value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
        />
        Active — generated for newly registered children
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className={SECONDARY} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminSchedulePage() {
  const [vaccines, setVaccines] = useState<AdminVaccine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [adding, setAdding] = useState<EntryFormValues | null>(null);
  const [editing, setEditing] = useState<{ entryId: string; values: EntryFormValues } | null>(null);

  const [asOf, setAsOf] = useState('');
  const [running, setRunning] = useState(false);
  const [runStats, setRunStats] = useState<ReminderCycleStats | null>(null);

  const load = useCallback(async (keep?: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await getAdminVaccines();
      setVaccines(list);
      setSelectedId((current) => {
        const wanted = keep ?? current;
        if (wanted && list.some((v) => v.id === wanted)) return wanted;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(getApiErrorMessage(err ,'Could not load vaccines and schedule entries.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = vaccines.find((v) => v.id === selectedId) ?? null;

  useEffect(() => {
    setName(selected?.name ?? '');
    setDescription(selected?.description ?? '');
    setAdding(null);
    setEditing(null);
    setActionError('');
    setActionOk('');
  }, [selected?.id]);

  const createVaccine = async () => {
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      const result = await createAdminVaccine({
        code: newCode,
        name: newName,
        description: newDescription.trim() === '' ? null : newDescription,
      });
      setActionOk(`Vaccine ${result.vaccine.code} created. Add its doses below.`);
      setNewCode('');
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
      await load(result.vaccine.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not create the vaccine.'));
    } finally {
      setBusy(false);
    }
  };

  const saveVaccine = async () => {
    if (!selected) return;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      const result = await updateAdminVaccine(selected.id, {
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
      });
      setActionOk(result.note ?? 'Vaccine updated.');
      await load(selected.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err,'Could not save the vaccine changes.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleVaccineActive = async () => {
    if (!selected) return;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      const result = await updateAdminVaccine(selected.id, { isActive: !selected.isActive });
      setActionOk(result.note ?? 'Vaccine updated.');
      await load(selected.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not create the schedule entry.'));
    } finally {
      setBusy(false);
    }
  };

  const submitAddEntry = async (values: EntryFormValues) => {
    if (!selected) return;
    const invalid = validateEntry(values, true);
    if (invalid) {
      setActionError(invalid);
      return;
    }
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      const result = await createAdminScheduleEntry(selected.id, {
        doseNumber: Number(values.doseNumber),
        ...baseFromValues(values),
      });
      setActionOk(result.note ?? 'Dose added.');
      setAdding(null);
      await load(selected.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not save the schedule entry changes.'));
    } finally {
      setBusy(false);
    }
  };

  const submitEditEntry = async (values: EntryFormValues) => {
    if (!editing) return;
    const invalid = validateEntry(values, false);
    if (invalid) {
      setActionError(invalid);
      return;
    }
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      const result = await updateAdminScheduleEntry(editing.entryId, baseFromValues(values));
      setActionOk(result.note ?? 'Dose updated.');
      setEditing(null);
      await load(selected?.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not run the reminder engine.'));
    } finally {
      setBusy(false);
    }
  };

  const runReminders = async () => {
    setRunning(true);
    setActionError('');
    setRunStats(null);
    try {
      let iso: string | undefined;
      if (asOf.trim() !== '') {
        const parsed = new Date(asOf);
        if (Number.isNaN(parsed.getTime())) {
          setActionError('Enter a valid date and time, or leave it blank to use now.');
          return;
        }
        iso = parsed.toISOString();
      }
      setRunStats(await runAdminReminders(iso));
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not change the vaccine status.'));
    } finally {
      setRunning(false);
    }
  };

  if (loading && vaccines.length === 0) return <Spinner label="Loading the vaccine catalogue…" />;
  if (error && vaccines.length === 0) return <ErrorBlock message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Vaccines and schedule</h2>
        <p className="mt-1 text-sm text-slate-500">
          Changes apply to children registered from now on. Children already registered keep the
          doses and dates they were given.
        </p>
      </div>

      {actionError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </p>
      )}
      {actionOk && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {actionOk}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card
            title="Vaccines"
            action={
              <button
                type="button"
                className="text-sm font-medium text-blue-700 hover:underline"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? 'Close' : 'Add vaccine'}
              </button>
            }
          >
            {vaccines.length === 0 ? (
              <p className="text-sm text-slate-500">No vaccines yet. Add the first one.</p>
            ) : (
              <ul className="space-y-1">
                {vaccines.map((v) => {
                  const isSelected = v.id === selectedId;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(v.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{v.code}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                              v.isActive
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : 'bg-slate-100 text-slate-600 ring-slate-200'
                            }`}
                          >
                            {v.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{v.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {v.scheduleEntries.length} dose
                          {v.scheduleEntries.length === 1 ? '' : 's'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {showCreate && (
            <Card title="New vaccine">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createVaccine();
                }}
              >
                <div>
                  <label className={LABEL} htmlFor="new-code">
                    Code
                  </label>
                  <input
                    id="new-code"
                    className={INPUT}
                    placeholder="e.g. BCG"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    2–20 characters: letters, digits, - or _, starting with a letter. Cannot be
                    changed later.
                  </p>
                </div>
                <div>
                  <label className={LABEL} htmlFor="new-name">
                    Name
                  </label>
                  <input
                    id="new-name"
                    className={INPUT}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="new-description">
                    Description (optional)
                  </label>
                  <textarea
                    id="new-description"
                    className={INPUT}
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <button type="submit" className={PRIMARY} disabled={busy}>
                  {busy ? 'Creating…' : 'Create vaccine'}
                </button>
              </form>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {!selected ? (
            <Card title="No vaccine selected">
              <p className="text-sm text-slate-500">
                Choose a vaccine on the left, or add a new one, to manage its doses.
              </p>
            </Card>
          ) : (
            <>
              <Card
                title={`${selected.code} — ${selected.name}`}
                description={selected.description ?? 'No description.'}
                action={
                  <button
                    type="button"
                    className={SECONDARY}
                    onClick={() => void toggleVaccineActive()}
                    disabled={busy}
                  >
                    {selected.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                }
              >
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveVaccine();
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL} htmlFor="vaccine-name">
                        Name
                      </label>
                      <input
                        id="vaccine-name"
                        className={INPUT}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="vaccine-description">
                        Description
                      </label>
                      <input
                        id="vaccine-description"
                        className={INPUT}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className={PRIMARY} disabled={busy}>
                    {busy ? 'Saving…' : 'Save vaccine'}
                  </button>
                </form>
              </Card>

              <Card
                title="Doses"
                description="Ordered as new children receive them. Dose numbers cannot be renumbered."
                action={
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-700 hover:underline"
                    onClick={() => setAdding(adding ? null : emptyEntry())}
                  >
                    {adding ? 'Close' : 'Add dose'}
                  </button>
                }
              >
                {adding && (
                  <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                    <p className="mb-3 text-sm font-medium text-slate-800">New dose</p>
                    <EntryForm
                      values={adding}
                      setValues={setAdding}
                      withDoseNumber
                      busy={busy}
                      submitLabel="Add dose"
                      onSubmit={(values) => void submitAddEntry(values)}
                      onCancel={() => setAdding(null)}
                    />
                  </div>
                )}

                {selected.scheduleEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No doses defined yet. A vaccine with no doses generates nothing for new children.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="py-2 pr-3 font-medium">#</th>
                          <th className="py-2 pr-3 font-medium">Label</th>
                          <th className="py-2 pr-3 font-medium">Age</th>
                          <th className="py-2 pr-3 font-medium">Applies to</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {selected.scheduleEntries.map((entry) => (
                          <tr key={entry.id} className="border-b border-slate-100 align-top last:border-0">
                            <td className="py-2 pr-3 tabular-nums text-slate-600">
                              {entry.doseNumber}
                            </td>
                            <td className="py-2 pr-3 text-slate-800">{entry.doseLabel}</td>
                            <td className="py-2 pr-3 text-slate-600">
                              {entry.ageLabel}
                              <span className="block text-xs text-slate-400">
                                {entry.ageValue} {entry.ageUnit.toLowerCase()}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-slate-600">
                              {applicabilityLabel(entry.applicability)}
                            </td>
                            <td className="py-2 pr-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                  entry.isActive
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                                }`}
                              >
                                {entry.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                className="text-sm font-medium text-blue-700 hover:underline"
                                onClick={() =>
                                  setEditing(
                                    editing?.entryId === entry.id
                                      ? null
                                      : { entryId: entry.id, values: entryToValues(entry) },
                                  )
                                }
                              >
                                {editing?.entryId === entry.id ? 'Close' : 'Edit'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {editing && (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-medium text-slate-800">
                      Editing dose{' '}
                      {
                        selected.scheduleEntries.find((e) => e.id === editing.entryId)
                          ?.doseNumber
                      }
                    </p>
                    <EntryForm
                      values={editing.values}
                      setValues={(values) => setEditing({ ...editing, values })}
                      withDoseNumber={false}
                      busy={busy}
                      submitLabel="Save dose"
                      onSubmit={(values) => void submitEditEntry(values)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}
              </Card>
            </>
          )}

          <Card
            title="Reminder engine"
            description="Normally runs on a timer. Run it now for a specific day during testing."
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56">
                <label className={LABEL} htmlFor="run-as-of">
                  Run as of (optional)
                </label>
                <input
                  id="run-as-of"
                  type="datetime-local"
                  className={INPUT}
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Leave blank to use the current time. Ignored outside development.
                </p>
              </div>
              <button
                type="button"
                className={PRIMARY}
                onClick={() => void runReminders()}
                disabled={running}
              >
                {running ? 'Running…' : 'Run reminders now'}
              </button>
            </div>

            {runStats && (
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    ['Created', runStats.created],
                    ['Revived', runStats.revived],
                    ['Cancelled', runStats.cancelled],
                    ['Recovered', runStats.recovered],
                    ['Groups', runStats.groupsProcessed],
                    ['Sent', runStats.sent],
                    ['Retried', runStats.retried],
                    ['Failed', runStats.failed],
                    ['Skipped', runStats.skipped],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import type { AdminFacility } from '../../types/admin';
import { FACILITY_TYPE_LABEL } from '../../types/admin';
import { addSpecialty, linkStaff, removeSpecialty, setFacilityActive, unlinkStaff } from '../../api/admin';
import { getApiErrorMessage } from '../../utils/errors';
import Button from '../ui/Button';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  facility: AdminFacility;
  specialtyOptions: string[];
  /** Re-fetch the list after a change; optionally show a notice. */
  onChanged: (notice?: string) => Promise<void>;
  onEdit: () => void;
}

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => Promise<void>;
  notice: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminFacilityCard({ facility, specialtyOptions, onChanged, onEdit }: Props) {
  const [specialty, setSpecialty] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [busy, setBusy] = useState<'specialty' | 'staff' | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const available = specialtyOptions.filter((s) => !facility.specialties.includes(s));

  const handleAddSpecialty = async () => {
    if (!specialty) return;
    setBusy('specialty');
    setError('');
    try {
      await addSpecialty(facility.id, specialty);
      setSpecialty('');
      await onChanged(`${specialty} added to ${facility.name}.`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add the specialty.'));
    } finally {
      setBusy(null);
    }
  };

  const handleLinkStaff = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const email = staffEmail.trim();
    if (!EMAIL_REGEX.test(email)) {
      setError('Enter a valid staff email address.');
      return;
    }
    setBusy('staff');
    setError('');
    try {
      await linkStaff(facility.id, email);
      setStaffEmail('');
      await onChanged(`${email} linked to ${facility.name}.`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not link the staff member.'));
    } finally {
      setBusy(null);
    }
  };

  const askConfirm = (c: PendingConfirm) => {
    setError('');
    setConfirm(c);
  };

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-5 ${
        facility.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 break-words">{facility.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5 break-words">{facility.address}</p>
          {facility.phone && <p className="text-sm text-slate-500">{facility.phone}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
            {FACILITY_TYPE_LABEL[facility.type]}
          </span>
          {!facility.isActive && (
            <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5">
              Inactive
            </span>
          )}
        </div>
      </div>

      {facility.latitude == null || facility.longitude == null ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No coordinates set, so distance can’t be calculated for this facility.
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          {facility.latitude.toFixed(5)}, {facility.longitude.toFixed(5)}
        </p>
      )}

      {/* Specialties */}
      <section aria-label={`Specialties for ${facility.name}`}>
        <h4 className="text-sm font-medium text-slate-700 mb-2">Specialties</h4>
        {facility.specialties.length === 0 ? (
          <p className="text-xs text-slate-500 mb-2">
            None tagged, so this facility won’t be shown as a specialty match.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 mb-3">
            {facility.specialties.map((s) => (
              <li
                key={s}
                className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-full pl-2.5 pr-1 py-1"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() =>
                    askConfirm({
                      title: 'Remove specialty',
                      message: `Remove ${s} from ${facility.name}? It will no longer be a specialty match for related diseases.`,
                      confirmLabel: 'Remove',
                      danger: true,
                      action: () => removeSpecialty(facility.id, s),
                      notice: `${s} removed from ${facility.name}.`,
                    })
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <select
            aria-label={`Choose a specialty to add to ${facility.name}`}
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            disabled={available.length === 0 || busy !== null}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{available.length === 0 ? 'All specialties added' : 'Choose a specialty…'}</option>
            {available.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            className="!py-2 !px-4"
            onClick={handleAddSpecialty}
            disabled={!specialty}
            loading={busy === 'specialty'}
            loadingText="Adding…"
          >
            Add
          </Button>
        </div>
      </section>

      {/* Staff */}
      <section aria-label={`Staff for ${facility.name}`}>
        <h4 className="text-sm font-medium text-slate-700 mb-2">Linked staff</h4>
        {facility.staff.length === 0 ? (
          <p className="text-xs text-slate-500 mb-2">
            No staff linked, so referrals sent here won’t reach anyone.
          </p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {facility.staff.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">{m.email}</span>
                <button
                  type="button"
                  onClick={() =>
                    askConfirm({
                      title: 'Unlink staff member',
                      message: `Unlink ${m.email} from ${facility.name}? They will stop receiving this facility’s referrals.`,
                      confirmLabel: 'Unlink',
                      danger: true,
                      action: () => unlinkStaff(facility.id, m.userId),
                      notice: `${m.email} unlinked from ${facility.name}.`,
                    })
                  }
                  className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleLinkStaff} className="flex gap-2">
          <input
            type="email"
            aria-label={`Staff email to link to ${facility.name}`}
            placeholder="staff@hospital.com"
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
            disabled={busy !== null}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <Button
            type="submit"
            variant="secondary"
            className="!py-2 !px-4"
            disabled={!staffEmail.trim()}
            loading={busy === 'staff'}
            loadingText="Linking…"
          >
            Link
          </Button>
        </form>
        <p className="text-xs text-slate-400 mt-1.5">
          The person must first register as Hospital Staff with the hospital reference code.
        </p>
      </section>

      {error && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-3 pt-4 border-t border-slate-100">
        <Button variant="secondary" className="!py-2 !px-4" onClick={onEdit}>
          Edit details
        </Button>
        {facility.isActive ? (
          <Button
            variant="secondary"
            className="!py-2 !px-4 text-red-600"
            onClick={() =>
              askConfirm({
                title: 'Deactivate facility',
                message: `Deactivate ${facility.name}? It will stop appearing in recommendations and can’t receive new referrals. Referrals already sent stay visible to its staff.`,
                confirmLabel: 'Deactivate',
                danger: true,
                action: async () => {
                  await setFacilityActive(facility.id, false);
                },
                notice: `${facility.name} deactivated.`,
              })
            }
          >
            Deactivate
          </Button>
        ) : (
          <Button
            className="!py-2 !px-4"
            onClick={() =>
              askConfirm({
                title: 'Reactivate facility',
                message: `Reactivate ${facility.name}? It will appear in recommendations again.`,
                confirmLabel: 'Reactivate',
                action: async () => {
                  await setFacilityActive(facility.id, true);
                },
                notice: `${facility.name} reactivated.`,
              })
            }
          >
            Reactivate
          </Button>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await confirm.action();
            setConfirm(null);
            await onChanged(confirm.notice);
          }}
        />
      )}
    </article>
  );
}

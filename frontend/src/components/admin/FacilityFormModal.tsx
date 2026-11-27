import { useState } from 'react';
import type { AdminFacility, FacilityFormValues, FacilityType } from '../../types/admin';
import { FACILITY_TYPE_LABEL } from '../../types/admin';
import Button from '../ui/Button';
import TextField from '../auth/TextField';
import { getApiErrorMessage } from '../../utils/errors';

interface Props {
  /** Pass a facility to edit it; omit to create a new one. */
  facility?: AdminFacility;
  onSubmit: (values: FacilityFormValues) => Promise<void>;
  onClose: () => void;
}

const parseCoord = (v: string): number | null => (v.trim() === '' ? null : Number(v));

/**
 * Mirrors the server's custom-code policy so a weak code is caught before the
 * request. The server re-checks every rule; this is only a convenience.
 */
export const customCodeProblem = (canonical: string): string | null => {
  if (canonical.length < 12 || canonical.length > 32) return 'Use 12 to 32 letters and digits';
  if (!/^[A-Z0-9]+$/.test(canonical)) return 'Use only letters and digits';
  if (!/[A-Z]/.test(canonical) || !/[0-9]/.test(canonical)) return 'Include at least one letter and one digit';
  if (new Set(canonical).size < 6) return 'Use at least 6 different characters';
  if (/(.)\1{3,}/.test(canonical)) return 'Do not repeat one character more than 3 times in a row';
  for (let size = 1; size <= 6; size += 1) {
    if (canonical.length % size !== 0 || size === canonical.length) continue;
    if (canonical.slice(0, size).repeat(canonical.length / size) === canonical) {
      return 'This is a repeated pattern. Use a less predictable code';
    }
  }
  return null;
};

export default function FacilityFormModal({ facility, onSubmit, onClose }: Props) {
  const [name, setName] = useState(facility?.name ?? '');
  const [type, setType] = useState<FacilityType>(facility?.type ?? 'PHC');
  const [address, setAddress] = useState(facility?.address ?? '');
  const [phone, setPhone] = useState(facility?.phone ?? '');
  const [latitude, setLatitude] = useState(facility?.latitude != null ? String(facility.latitude) : '');
  const [longitude, setLongitude] = useState(facility?.longitude != null ? String(facility.longitude) : '');
  const [codeMode, setCodeMode] = useState<'GENERATE' | 'CUSTOM'>('GENERATE');
  const [customCode, setCustomCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMsg('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setLocationMsg('Could not get your location. Enter the coordinates manually.');
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Facility name is required';
    if (!address.trim()) e.address = 'Address is required';

    const lat = parseCoord(latitude);
    const lng = parseCoord(longitude);
    if ((lat === null) !== (lng === null)) {
      e.latitude = 'Enter both latitude and longitude, or leave both empty';
    }
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      e.latitude = 'Latitude must be a number between -90 and 90';
    }
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      e.longitude = 'Longitude must be a number between -180 and 180';
    }

    if (!facility && codeMode === 'CUSTOM') {
      const canonical = customCode.trim().toUpperCase().replace(/[\s-]/g, '');
      const problem = customCodeProblem(canonical);
      if (problem) e.registrationCode = problem;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError('');
    try {
      await onSubmit({
        name: name.trim(),
        type,
        address: address.trim(),
        phone: phone.trim(),
        latitude: parseCoord(latitude),
        longitude: parseCoord(longitude),
        ...(facility
          ? {}
          : codeMode === 'CUSTOM'
            ? { registrationCode: customCode.trim() }
            : { generateRegistrationCode: true }),
      });
    } catch (err) {
      setApiError(getApiErrorMessage(err, 'Could not save the facility. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-form-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-lg p-6 my-4"
      >
        <h2 id="facility-form-title" className="text-lg font-semibold text-slate-900">
          {facility ? 'Edit facility' : 'Add facility'}
        </h2>

        <div className="mt-5 space-y-4">
          <TextField label="Facility name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />

          <div>
            <label htmlFor="facility-type" className="block text-sm font-medium text-slate-700 mb-1.5">
              Type
            </label>
            <select
              id="facility-type"
              value={type}
              onChange={(e) => setType(e.target.value as FacilityType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {(Object.keys(FACILITY_TYPE_LABEL) as FacilityType[]).map((t) => (
                <option key={t} value={t}>
                  {FACILITY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} error={errors.address} />
          <TextField label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

          {!facility && (
            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 mb-1.5">
                Facility registration code
              </legend>
              <p className="mb-2 text-xs text-slate-500">
                Hospital staff enter this code when they register, so their account is linked to
                this facility automatically. It applies to every facility type.
              </p>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="code-mode"
                    checked={codeMode === 'GENERATE'}
                    onChange={() => {
                      setCodeMode('GENERATE');
                      setErrors((prev) => ({ ...prev, registrationCode: '' }));
                    }}
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-400"
                  />
                  <span>
                    <span className="font-medium text-slate-800">Generate a secure code</span>
                    <span className="block text-xs text-slate-500">
                      Shown once after the facility is created.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="code-mode"
                    checked={codeMode === 'CUSTOM'}
                    onChange={() => setCodeMode('CUSTOM')}
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-400"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-slate-800">Enter a custom code</span>
                    <span className="block text-xs text-slate-500">
                      12–32 letters and digits, with at least one of each. Avoid repeated or predictable
                      patterns: short codes such as HOSP123 are not accepted.
                    </span>
                  </span>
                </label>

                {codeMode === 'CUSTOM' && (
                  <div>
                    <TextField
                      label="Code"
                      value={customCode}
                      onChange={(e) => {
                        setCustomCode(e.target.value.toUpperCase());
                        setErrors((prev) => ({ ...prev, registrationCode: '' }));
                      }}
                      error={errors.registrationCode}
                      placeholder="e.g. PHC2026NORTH1"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 mb-1.5">
              Location (optional)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Latitude"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                error={errors.latitude}
              />
              <TextField
                label="Longitude"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                error={errors.longitude}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" className="!py-1.5 !px-3" onClick={useMyLocation} loading={locating} loadingText="Locating…">
                Use my current location
              </Button>
              <span className="text-xs text-slate-500">
                Only use this if you are at the facility. Coordinates are needed to sort recommendations by distance.
              </span>
            </div>
            {locationMsg && <p className="text-xs text-amber-600 mt-2">{locationMsg}</p>}
          </fieldset>
        </div>

        {apiError && (
          <div role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            {apiError}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} loadingText="Saving…">
            {facility ? 'Save changes' : 'Add facility'}
          </Button>
        </div>
      </form>
    </div>
  );
}

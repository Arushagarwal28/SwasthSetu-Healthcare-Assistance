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

export default function FacilityFormModal({ facility, onSubmit, onClose }: Props) {
  const [name, setName] = useState(facility?.name ?? '');
  const [type, setType] = useState<FacilityType>(facility?.type ?? 'PHC');
  const [address, setAddress] = useState(facility?.address ?? '');
  const [phone, setPhone] = useState(facility?.phone ?? '');
  const [latitude, setLatitude] = useState(facility?.latitude != null ? String(facility.latitude) : '');
  const [longitude, setLongitude] = useState(facility?.longitude != null ? String(facility.longitude) : '');
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

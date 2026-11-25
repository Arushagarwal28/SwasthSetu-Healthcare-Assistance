/**
 * One vaccination centre — GET /vaccination/centres/:facilityId, plus the two
 * management endpoints for ADMIN and HOSPITAL_STAFF:
 *   PUT   /vaccination/centres/:facilityId/vaccines  (replaces the whole list)
 *   PATCH /vaccination/centres/:facilityId/location  (district, PIN code)
 *
 * The backend decides who may manage which facility (staff only their linked
 * ones), so this page only hides the controls it knows are unavailable.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  getVaccinationCentre,
  getVaccinationSchedule,
  setCentreVaccines,
  updateCentreLocation,
} from '../../api/vaccination';
import { getApiErrorMessage } from '../../utils/errors';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';

interface CentreVaccine {
  code: string;
  name: string;
  sessionInfo: string | null;
}

interface CentreDetail {
  id: string;
  name: string;
  type: string;
  address: string;
  district: string | null;
  pinCode: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  vaccines: CentreVaccine[];
}

interface VaccineLike {
  code: string;
  name: string;
}

interface OfferedVaccine {
  code: string;
  sessionInfo: string;
}

const MAX_OFFERINGS = 40;
const MAX_SESSION_INFO = 200;

export default function CentreDetailPage() {
  const { facilityId = '' } = useParams();
  const basePath = /(\/[^/]+\/vaccination)(?=\/|$)/.exec(useLocation().pathname)?.[1] ?? '';
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'HOSPITAL_STAFF';

  const [centre, setCentre] = useState<CentreDetail | null>(null);
  const [catalogue, setCatalogue] = useState<VaccineLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // offering editor
  const [offered, setOffered] = useState<OfferedVaccine[]>([]);
  const [savingVaccines, setSavingVaccines] = useState(false);
  const [vaccineError, setVaccineError] = useState('');
  const [vaccineSaved, setVaccineSaved] = useState('');

  // location editor
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationSaved, setLocationSaved] = useState('');

  useEffect(() => {
    if (facilityId === '') {
      setError('No vaccination centre was selected.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([getVaccinationCentre(facilityId), getVaccinationSchedule()])
      .then(([centrePayload, schedulePayload]) => {
        if (cancelled) return;
        const detail = centrePayload as unknown as CentreDetail;
        setCentre(detail);
        setCatalogue(
          (schedulePayload as unknown as VaccineLike[]).map((v) => ({ code: v.code, name: v.name })),
        );
        setOffered(detail.vaccines.map((v) => ({ code: v.code, sessionInfo: v.sessionInfo ?? '' })));
        setDistrict(detail.district ?? '');
        setPinCode(detail.pinCode ?? '');
        setVaccineError('');
        setVaccineSaved('');
        setLocationError('');
        setLocationSaved('');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, 'Could not load this vaccination centre.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facilityId, reloadKey]);

  const isOffered = (code: string): boolean => offered.some((o) => o.code === code);

  const toggleOffered = (code: string) => {
    setVaccineSaved('');
    setVaccineError('');
    setOffered((current) =>
      current.some((o) => o.code === code)
        ? current.filter((o) => o.code !== code)
        : [...current, { code, sessionInfo: '' }],
    );
  };

  const changeSessionInfo = (code: string, value: string) => {
    setVaccineSaved('');
    setOffered((current) =>
      current.map((o) => (o.code === code ? { ...o, sessionInfo: value } : o)),
    );
  };

  const saveVaccines = async () => {
    setVaccineError('');
    setVaccineSaved('');

    if (offered.length > MAX_OFFERINGS) {
      setVaccineError(`A facility can offer at most ${MAX_OFFERINGS} vaccines.`);
      return;
    }
    const tooLong = offered.find((o) => o.sessionInfo.trim().length > MAX_SESSION_INFO);
    if (tooLong) {
      setVaccineError(`Session details for ${tooLong.code} must be at most ${MAX_SESSION_INFO} characters.`);
      return;
    }

    setSavingVaccines(true);
    try {
      const updated = await setCentreVaccines(
        facilityId,
        offered.map((o) =>
          o.sessionInfo.trim() === ''
            ? { vaccineCode: o.code }
            : { vaccineCode: o.code, sessionInfo: o.sessionInfo.trim() },
        ),
      );
      const detail = updated as unknown as CentreDetail;
      setCentre(detail);
      setOffered(detail.vaccines.map((v) => ({ code: v.code, sessionInfo: v.sessionInfo ?? '' })));
      setVaccineSaved('Vaccination services saved.');
    } catch (err: unknown) {
      setVaccineError(getApiErrorMessage(err, 'Could not save the vaccination services.'));
    } finally {
      setSavingVaccines(false);
    }
  };

  const saveLocation = async () => {
    setLocationError('');
    setLocationSaved('');

    const nextDistrict = district.trim();
    const nextPin = pinCode.trim();
    const body: { district?: string; pinCode?: string } = {};

    if (nextDistrict !== (centre?.district ?? '')) {
      if (nextDistrict === '') {
        setLocationError('District cannot be empty.');
        return;
      }
      body.district = nextDistrict;
    }

    if (nextPin !== (centre?.pinCode ?? '')) {
      if (!/^\d{6}$/.test(nextPin)) {
        setLocationError('Enter a 6-digit PIN code.');
        return;
      }
      body.pinCode = nextPin;
    }

    if (body.district === undefined && body.pinCode === undefined) {
      setLocationError('Nothing has changed yet.');
      return;
    }

    setSavingLocation(true);
    try {
      const updated = await updateCentreLocation(facilityId, body);
      const detail = updated as unknown as CentreDetail;
      setCentre(detail);
      setDistrict(detail.district ?? '');
      setPinCode(detail.pinCode ?? '');
      setLocationSaved('Location saved. Centre search now uses it.');
    } catch (err: unknown) {
      setLocationError(getApiErrorMessage(err, 'Could not save the location.'));
    } finally {
      setSavingLocation(false);
    }
  };

  if (loading) return <Spinner label="Loading the centre…" />;

  if (error !== '' || !centre) {
    return (
      <Card>
        <ErrorBlock
          message={error === '' ? 'Could not load this vaccination centre.' : error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      </Card>
    );
  }

  const place = [centre.district, centre.pinCode].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`${basePath}/centres`}
          className="text-sm text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          ← All centres
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{centre.name}</h1>
        <p className="text-sm text-slate-500">
          {centre.address}
          {place !== '' && ` · ${place}`}
        </p>
        {centre.phone && (
          <p className="text-sm text-slate-500">
            <a href={`tel:${centre.phone}`} className="text-blue-700 hover:underline">
              {centre.phone}
            </a>
          </p>
        )}
      </div>

      {!canManage && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
          You can view this centre. Only its hospital staff or an administrator can change what it
          offers.
        </p>
      )}

      <Card
        title="Location used by search"
        description="Centre search filters by exact district and PIN code."
      >
        <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">District</span>
            <input
              type="text"
              value={district}
              maxLength={100}
              disabled={!canManage}
              onChange={(e) => setDistrict(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">PIN code</span>
            <input
              type="text"
              inputMode="numeric"
              value={pinCode}
              maxLength={6}
              disabled={!canManage}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>

        {centre.latitude !== null && centre.longitude !== null && (
          <p className="mt-3 text-xs text-slate-500">
            Coordinates on file: {centre.latitude.toFixed(4)}, {centre.longitude.toFixed(4)} — used to
            rank centres by distance.
          </p>
        )}

        {locationError !== '' && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {locationError}
          </p>
        )}
        {locationSaved !== '' && (
          <p role="status" className="mt-3 text-sm text-emerald-700">
            {locationSaved}
          </p>
        )}

        {canManage && (
          <div className="mt-4">
            <Button onClick={() => void saveLocation()} loading={savingLocation} loadingText="Saving…">
              Save location
            </Button>
          </div>
        )}
      </Card>

      <Card
        title="Vaccination services"
        description={
          canManage
            ? 'Tick every vaccine this facility gives. Saving replaces the whole list, so unticked vaccines stop being offered.'
            : 'Vaccines this facility currently offers.'
        }
      >
        {canManage ? (
          <>
            <ul role="list" className="divide-y divide-slate-100">
              {catalogue.map((vaccine) => {
                const selected = isOffered(vaccine.code);
                const entry = offered.find((o) => o.code === vaccine.code);
                return (
                  <li key={vaccine.code} className="py-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOffered(vaccine.code)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-400"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">
                          {vaccine.name}{' '}
                          <span className="text-xs font-normal text-slate-500">{vaccine.code}</span>
                        </span>
                      </span>
                    </label>

                    {selected && entry && (
                      <div className="mt-2 pl-7">
                        <label className="block">
                          <span className="text-xs text-slate-500">
                            Session details (optional) — e.g. “Mon &amp; Thu, 9am–1pm”
                          </span>
                          <input
                            type="text"
                            value={entry.sessionInfo}
                            maxLength={MAX_SESSION_INFO}
                            onChange={(e) => changeSessionInfo(vaccine.code, e.target.value)}
                            className="mt-1 w-full max-w-lg rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {catalogue.length === 0 && (
              <p className="text-sm text-slate-500">
                No active vaccines exist yet, so there is nothing to offer.
              </p>
            )}

            {offered.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">{offered.length} vaccine(s) selected.</p>
            )}

            {vaccineError !== '' && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {vaccineError}
              </p>
            )}
            {vaccineSaved !== '' && (
              <p role="status" className="mt-3 text-sm text-emerald-700">
                {vaccineSaved}
              </p>
            )}

            <div className="mt-4">
              <Button
                onClick={() => void saveVaccines()}
                loading={savingVaccines}
                loadingText="Saving…"
              >
                Save vaccination services
              </Button>
            </div>
          </>
        ) : centre.vaccines.length === 0 ? (
          <p className="text-sm text-slate-500">This facility does not offer any vaccine yet.</p>
        ) : (
          <ul role="list" className="divide-y divide-slate-100">
            {centre.vaccines.map((vaccine) => (
              <li key={vaccine.code} className="py-3">
                <p className="text-sm font-medium text-slate-900">
                  {vaccine.name} <span className="text-xs font-normal text-slate-500">{vaccine.code}</span>
                </p>
                {vaccine.sessionInfo && (
                  <p className="text-xs text-slate-500">{vaccine.sessionInfo}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
/**
 * Vaccination centre search (any signed-in user) — GET /vaccination/centres.
 *
 * The backend does the filtering and ranking: name/address text, district, PIN
 * code, offered vaccine codes, and distance when coordinates are given. It
 * already skips facilities that offer no active vaccine, so an empty result can
 * legitimately mean "no centre near here offers this vaccine".
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getVaccinationSchedule, searchVaccinationCentres } from '../../api/vaccination';
import { getApiErrorMessage } from '../../utils/errors';
import { useAuth } from '../../auth/AuthContext';
import { primaryButtonLink } from '../../components/ui/buttonLink';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';

interface CentreVaccine {
  code: string;
  name: string;
  sessionInfo: string | null;
}

interface CentreItem {
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
  distanceKm: number | null;
  matchedVaccineCodes: string[];
}

interface CentreSearchPayload {
  total: number;
  page: number;
  limit: number;
  items: CentreItem[];
}

/** Just the two fields this page needs from GET /vaccination/schedule. */
interface VaccineLike {
  code: string;
  name: string;
}

interface AppliedFilters {
  q: string;
  district: string;
  pinCode: string;
  codes: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

const PAGE_SIZE = 20;
const RADIUS_CHOICES = [5, 10, 25, 50];
const EMPTY_FILTERS: AppliedFilters = { q: '', district: '', pinCode: '', codes: [] };

/** 'CHC' / 'DISTRICT_HOSPITAL' -> 'CHC' / 'District hospital'. */
const prettyType = (type: string): string => {
  if (type === '') return 'Facility';
  if (type.length <= 5 && type === type.toUpperCase()) return type;
  const words = type.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export default function CentresPage() {
  const { user } = useAuth();
  const basePath = /(\/[^/]+\/vaccination)(?=\/|$)/.exec(useLocation().pathname)?.[1] ?? '';
  const canManage = user?.role === 'ADMIN' || user?.role === 'HOSPITAL_STAFF';

  // ---- filter form (only applied on Search) ----
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');

  // ---- applied filters + results ----
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CentreSearchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // ---- vaccine catalogue for the filter chips ----
  const [catalogue, setCatalogue] = useState<VaccineLike[]>([]);
  const [catalogueError, setCatalogueError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getVaccinationSchedule()
      .then((list) => {
        if (cancelled) return;
        setCatalogue((list as unknown as VaccineLike[]).map((v) => ({ code: v.code, name: v.name })));
      })
      .catch(() => {
        if (!cancelled) setCatalogueError('The vaccine list could not be loaded; search by place instead.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    searchVaccinationCentres({
      q: applied.q === '' ? undefined : applied.q,
      district: applied.district === '' ? undefined : applied.district,
      pinCode: applied.pinCode === '' ? undefined : applied.pinCode,
      vaccineCode: applied.codes.length === 0 ? undefined : applied.codes,
      lat: applied.lat,
      lng: applied.lng,
      radiusKm: applied.radiusKm,
      page,
      limit: PAGE_SIZE,
    })
      .then((payload) => {
        if (cancelled) return;
        setData(payload as unknown as CentreSearchPayload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          getApiErrorMessage(err, 'Could not search vaccination centres. Please try again.'),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applied, page, reloadKey]);

  const applyFilters = (next: AppliedFilters) => {
    setApplied(next);
    setPage(1);
  };

  const search = () => {
    applyFilters({
      q: q.trim(),
      district: district.trim(),
      pinCode: pinCode.trim(),
      codes,
      ...(coords ? { lat: coords.lat, lng: coords.lng, radiusKm } : {}),
    });
  };

  const clearAll = () => {
    setQ('');
    setDistrict('');
    setPinCode('');
    setCodes([]);
    setCoords(null);
    setRadiusKm(10);
    setGeoMessage('');
    applyFilters(EMPTY_FILTERS);
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('This browser cannot share your location. Search by district or PIN code instead.');
      return;
    }
    setLocating(true);
    setGeoMessage('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        };
        setCoords(next);
        setLocating(false);
        setGeoMessage('Location added. Nearest centres are listed first.');
        applyFilters({
          q: q.trim(),
          district: district.trim(),
          pinCode: pinCode.trim(),
          codes,
          lat: next.lat,
          lng: next.lng,
          radiusKm,
        });
      },
      () => {
        setLocating(false);
        setGeoMessage('Location permission was denied. Search by district or PIN code instead.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const clearLocation = () => {
    setCoords(null);
    setGeoMessage('');
    applyFilters({
      q: q.trim(),
      district: district.trim(),
      pinCode: pinCode.trim(),
      codes,
    });
  };

  const toggleCode = (code: string) => {
    setCodes((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasFilters =
    applied.q !== '' ||
    applied.district !== '' ||
    applied.pinCode !== '' ||
    applied.codes.length > 0 ||
    applied.lat !== undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Vaccination centres</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Find a facility that offers the vaccine you need.
        </p>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Centre name or address</span>
            <input
              type="text"
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search();
              }}
              placeholder="e.g. Primary Health Centre"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">District</span>
            <input
              type="text"
              value={district}
              maxLength={100}
              onChange={(e) => setDistrict(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search();
              }}
              placeholder="Exact district name"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">PIN code</span>
            <input
              type="text"
              inputMode="numeric"
              value={pinCode}
              maxLength={6}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search();
              }}
              placeholder="6 digits"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600">Offers vaccine</p>
          {catalogueError !== '' ? (
            <p className="mt-1 text-xs text-amber-700">{catalogueError}</p>
          ) : catalogue.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">Loading the vaccine list…</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {catalogue.map((vaccine) => {
                const selected = codes.includes(vaccine.code);
                return (
                  <button
                    key={vaccine.code}
                    type="button"
                    onClick={() => toggleCode(vaccine.code)}
                    aria-pressed={selected}
                    title={vaccine.name}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {vaccine.code}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="secondary" onClick={useMyLocation} loading={locating} loadingText="Locating…">
              {coords ? 'Update my location' : 'Use my location'}
            </Button>
            {coords ? (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span>within</span>
                  <select
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                  >
                    {RADIUS_CHOICES.map((km) => (
                      <option key={km} value={km}>
                        {km} km
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-xs text-slate-500 underline hover:text-slate-800"
                >
                  Clear location
                </button>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={clearAll}>
              Clear
            </Button>
            <Button onClick={search} loading={loading} loadingText="Searching…">
              Search
            </Button>
          </div>
        </div>

        {geoMessage !== '' && <p className="mt-3 text-xs text-slate-600">{geoMessage}</p>}
      </Card>

      {loading && !data && <Spinner label="Searching vaccination centres…" />}

      {error !== '' && (
        <Card>
          <ErrorBlock message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </Card>
      )}

      {!error && data && data.items.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No centre matches these filters' : 'No vaccination centres yet'}
          description={
            hasFilters
              ? 'Try a nearby district, a wider radius, or fewer vaccine filters.'
              : 'No facility currently offers an active vaccine. Ask your administrator to add vaccination services.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearAll}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <p className="text-xs text-slate-500" aria-live="polite">
            {data.total} centre{data.total === 1 ? '' : 's'}
            {loading && ' · updating…'}
          </p>

          <ul role="list" className="space-y-3">
            {data.items.map((centre) => {
              const matched = new Set(centre.matchedVaccineCodes);
              const place = [centre.district, centre.pinCode].filter(Boolean).join(' · ');
              return (
                <li
                  key={centre.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-slate-900">{centre.name}</h2>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {prettyType(centre.type)}
                        </span>
                        {centre.distanceKm !== null && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            {centre.distanceKm} km
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-600">{centre.address}</p>
                      {place !== '' && <p className="text-xs text-slate-500">{place}</p>}

                      {centre.vaccines.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {centre.vaccines.map((vaccine) => (
                            <span
                              key={vaccine.code}
                              title={`${vaccine.name}${vaccine.sessionInfo ? ` · ${vaccine.sessionInfo}` : ''}`}
                              className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                matched.has(vaccine.code)
                                  ? 'border-blue-300 bg-blue-50 font-medium text-blue-800'
                                  : 'border-slate-200 bg-white text-slate-600'
                              }`}
                            >
                              {vaccine.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-stretch">
                      {centre.phone && (
                        <a
                          href={`tel:${centre.phone}`}
                          className="rounded-md border border-slate-300 px-3.5 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          Call
                        </a>
                      )}
                      <Link
                        to={`${basePath}/centres/${centre.id}`}
                        className={primaryButtonLink}
                      >
                        {canManage ? 'Manage' : 'Details'}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                disabled={data.page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <p className="text-xs text-slate-500">
                Page {data.page} of {totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={data.page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
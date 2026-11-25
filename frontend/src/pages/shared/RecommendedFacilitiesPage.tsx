import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchRecommendedFacilities } from '../../api/triage';
import {
  cancelReferral,
  createReferral,
  fetchNextSuggestions,
  fetchReferralByAssessment,
} from '../../api/referrals';
import type { RecommendationResult, RecommendedFacility } from '../../types/facility';
import type { Referral } from '../../types/referral';
import { getApiErrorMessage } from '../../utils/errors';
import { useReferralUpdates } from '../../realtime/useReferralUpdates';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ErrorBlock from '../../components/ui/ErrorBlock';
import UrgencyBadge from '../../components/triage/UrgencyBadge';
import ReferralStatusCard from '../../components/referral/ReferralStatusCard';
import ConfirmReferralModal from '../../components/referral/ConfirmReferralModal';

interface Props {
  backTo: string; // '/patient' or '/helper'
}

type Coords = { lat: number; lng: number };

const getCoords = (onDenied: () => void): Promise<Coords | undefined> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        onDenied();
        resolve(undefined);
      },
      { timeout: 5000 }
    );
  });

export default function RecommendedFacilitiesPage({ backTo }: Props) {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();

  const [referral, setReferral] = useState<Referral | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationDenied, setLocationDenied] = useState(false);
  const [selected, setSelected] = useState<RecommendedFacility | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');

  // Ask for location once, not on every refresh
  const coordsRef = useRef<Coords | undefined>(undefined);
  const coordsResolved = useRef(false);

  // `silent` refreshes in the background (live updates) without the spinner
  const loadAll = useCallback(
    async (options: { silent?: boolean } = {}) => {
    if (!assessmentId) return;
    if (!options.silent) setLoading(true);
    setError('');
    try {
      if (!coordsResolved.current) {
        coordsRef.current = await getCoords(() => setLocationDenied(true));
        coordsResolved.current = true;
      }
      const coords = coordsRef.current;
      const existing = await fetchReferralByAssessment(assessmentId);
      setReferral(existing);

      // Only offer a facility list when a new referral can actually be sent
      if (!existing || existing.status === 'CANCELLED') {
        setResult(await fetchRecommendedFacilities(assessmentId, coords));
      } else if (existing.status === 'REJECTED') {
        setResult(await fetchNextSuggestions(existing.id, coords));
      } else {
        setResult(null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load referral information. Please try again.'));
    } finally {
      setLoading(false);
    }
    },
    [assessmentId]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live updates: refresh quietly when this assessment's referral changes
  useReferralUpdates((event) => {
    if (!event || event.assessmentId === assessmentId) loadAll({ silent: true });
  });

  const handleSend = async (note: string) => {
    if (!assessmentId || !selected) return;
    const created = await createReferral(assessmentId, selected.id, note);
    setReferral(created);
    setResult(null);
    setSelected(null);
    setActionError('');
  };

  const handleCancel = async () => {
    if (!referral) return;
    setCancelling(true);
    setActionError('');
    try {
      await cancelReferral(referral.id);
      await loadAll();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not cancel the referral. Please try again.'));
    } finally {
      setCancelling(false);
    }
  };

  const isRetryList = referral?.status === 'REJECTED';

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4 pb-10">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-slate-900">
          {referral && !isRetryList && referral.status !== 'CANCELLED'
            ? 'Referral'
            : 'Recommended Facilities'}
        </h1>
        <button
          onClick={() => navigate(backTo)}
          className="text-sm text-slate-500 hover:text-slate-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Back to dashboard
        </button>
      </div>

      {loading && <Spinner label="Loading…" />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => loadAll()} />}

      {!loading && !error && (
        <>
          {referral && (
            <ReferralStatusCard referral={referral} onCancel={handleCancel} cancelling={cancelling} />
          )}
          {actionError && (
            <div role="alert" className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {actionError}
            </div>
          )}

          {result && (
            <>
              <Card className="mb-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm text-slate-500">
                    {isRetryList ? 'Other options for this screening result' : 'Based on the screening result'}
                  </p>
                  <UrgencyBadge urgency={result.urgency} />
                </div>
                <p className="font-medium text-slate-900">{result.predictedDisease}</p>
                <p className="text-sm text-slate-500 mt-1">{result.explanation}</p>
                {isRetryList && (
                  <p className="text-xs text-slate-500 mt-2">
                    Facilities that were already tried for this assessment are not shown.
                  </p>
                )}
                {locationDenied && (
                  <p className="text-xs text-amber-600 mt-3">
                    Location access wasn't available, so results aren't sorted by distance.
                  </p>
                )}
              </Card>

              {result.facilities.length === 0 ? (
                <Card>
                  <p className="text-sm text-slate-500 text-center py-6">
                    {isRetryList
                      ? 'No other facilities are available to refer to right now.'
                      : 'No facilities are available in the system yet for this recommendation.'}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {result.facilities.map((f) => (
                    <Card key={f.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{f.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {f.type.replace('_', ' ')} · {f.address}
                          </p>
                          {f.phone && <p className="text-sm text-slate-600 mt-1">{f.phone}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          {f.matchedSpecialty && (
                            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              Specialty match
                            </span>
                          )}
                          {f.distanceKm != null && (
                            <p className="text-sm text-slate-500 mt-1.5">{f.distanceKm} km</p>
                          )}
                        </div>
                      </div>
                      <Button className="w-full mt-4 !py-2" onClick={() => setSelected(f)}>
                        Request referral
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <Button variant="secondary" className="w-full mt-6" onClick={() => navigate(backTo)}>
        Done
      </Button>

      {selected && (
        <ConfirmReferralModal
          facilityName={selected.name}
          onConfirm={handleSend}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/**
 * Filtering and ranking of vaccination centres. Pure functions, tested in centre.search.test.ts.
 */
import { haversineDistanceKm } from '../../utils/geo';

export interface CentreVaccine {
  code: string;
  name: string;
  sessionInfo: string | null;
}

export interface CentreRow {
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

export interface CentreFilters {
  q?: string | undefined;
  district?: string | undefined;
  pinCode?: string | undefined;
  vaccineCodes?: string[] | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  radiusKm?: number | undefined;
}

export type RankedCentre = CentreRow & {
  distanceKm: number | null;
  matchedVaccineCodes: string[];
};

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();
const round1 = (n: number): number => Math.round(n * 10) / 10;

export const filterAndRank = (rows: CentreRow[], f: CentreFilters): RankedCentre[] => {
  const q = f.q ? norm(f.q) : '';
  const district = f.district ? norm(f.district) : '';
  const wanted = (f.vaccineCodes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const hasPoint = typeof f.lat === 'number' && typeof f.lng === 'number';

  const out: RankedCentre[] = [];
  for (const c of rows) {
    if (district && norm(c.district ?? '') !== district) continue;
    if (f.pinCode && (c.pinCode ?? '') !== f.pinCode) continue;
    if (q && !norm(`${c.name} ${c.address}`).includes(q)) continue;

    const offered = new Set(c.vaccines.map((v) => v.code.toUpperCase()));
    const matched = wanted.filter((code) => offered.has(code));
    if (wanted.length > 0 && matched.length === 0) continue;

    let distanceKm: number | null = null;
    if (hasPoint && c.latitude !== null && c.longitude !== null) {
      distanceKm = round1(haversineDistanceKm(f.lat as number, f.lng as number, c.latitude, c.longitude));
    }
    if (typeof f.radiusKm === 'number' && hasPoint && (distanceKm === null || distanceKm > f.radiusKm)) continue;

    out.push({ ...c, distanceKm, matchedVaccineCodes: matched });
  }

  out.sort((a, b) => {
    if (hasPoint) {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    }
    // more of the wanted vaccines first, then by name
    return b.matchedVaccineCodes.length - a.matchedVaccineCodes.length || a.name.localeCompare(b.name);
  });
  return out;
};

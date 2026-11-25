import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter, getLinkedFacilityIds } from './child.access';
import type { Actor } from './child.access';
import { filterAndRank } from './centre.search';
import type { CentreFilters, CentreRow } from './centre.search';
import { cleanText } from './child.utils';
import { todayInIst } from './vaccination.dates';
import { deriveDoseStatus } from './vaccination.schedule';
import { toYmd } from './child.utils';

const centreSelect = {
  id: true,
  name: true,
  type: true,
  address: true,
  district: true,
  pinCode: true,
  phone: true,
  latitude: true,
  longitude: true,
  vaccineServices: {
    where: { isActive: true, vaccine: { isActive: true } },
    select: { sessionInfo: true, vaccine: { select: { code: true, name: true } } },
  },
} satisfies Prisma.FacilitySelect;

type CentreRecord = Prisma.FacilityGetPayload<{ select: typeof centreSelect }>;

const toRow = (f: CentreRecord): CentreRow => ({
  id: f.id,
  name: f.name,
  type: f.type,
  address: f.address,
  district: f.district,
  pinCode: f.pinCode,
  phone: f.phone,
  latitude: f.latitude,
  longitude: f.longitude,
  vaccines: f.vaccineServices
    .map((s) => ({ code: s.vaccine.code, name: s.vaccine.name, sessionInfo: s.sessionInfo }))
    .sort((a, b) => a.code.localeCompare(b.code)),
});

/** Active facilities that offer at least one active vaccine (optionally one of the given codes). */
const loadCentres = async (codes: string[] | undefined): Promise<CentreRow[]> => {
  const wanted = (codes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const rows = await prisma.facility.findMany({
    where: {
      isActive: true,
      vaccineServices: {
        some: { isActive: true, vaccine: { isActive: true, ...(wanted.length > 0 ? { code: { in: wanted } } : {}) } },
      },
    },
    select: centreSelect,
    take: 2000,
  });
  return rows.map(toRow);
};

// ---------- search ----------

export const searchCentres = async (filters: CentreFilters, page: number, limit: number) => {
  const all = filterAndRank(await loadCentres(filters.vaccineCodes), filters);
  return { total: all.length, page, limit, items: all.slice((page - 1) * limit, page * limit) };
};

export const getCentre = async (facilityId: string) => {
  const f = await prisma.facility.findFirst({ where: { id: facilityId, isActive: true }, select: centreSelect });
  if (!f) throw new AppError('Vaccination centre not found', 404);
  return toRow(f);
};

/**
 * Centres for the vaccines a child needs next: everything overdue or due today,
 * plus whatever falls on the next upcoming date. With coordinates the nearest
 * centres come first; without them the child's district is used.
 */
export const centresForChild = async (
  actor: Actor,
  childId: string,
  requestedCodes: string[] | undefined,
  radiusKm: number | undefined,
  limit: number
) => {
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    select: {
      latitude: true,
      longitude: true,
      district: true,
      doses: { select: { vaccineCode: true, dueDate: true, recordedStatus: true } },
    },
  });
  if (!child) throw new AppError('Child not found', 404);

  const today = todayInIst();
  let codes: string[];
  if (requestedCodes && requestedCodes.length > 0) {
    codes = requestedCodes;
  } else {
    const open = child.doses
      .map((d) => ({ code: d.vaccineCode, due: toYmd(d.dueDate), status: deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate: toYmd(d.dueDate) }, today) }))
      .filter((d) => d.status === 'OVERDUE' || d.status === 'DUE' || d.status === 'UPCOMING' || d.status === 'POSTPONED');
    const pastOrToday = open.filter((d) => d.due <= today);
    const future = open.filter((d) => d.due > today).sort((a, b) => a.due.localeCompare(b.due));
    const nextDate = future[0]?.due;
    codes = [...new Set([...pastOrToday, ...future.filter((d) => d.due === nextDate)].map((d) => d.code))];
  }

  const hasPoint = child.latitude !== null && child.longitude !== null;
  const filters: CentreFilters = {
    vaccineCodes: codes,
    ...(hasPoint ? { lat: child.latitude as number, lng: child.longitude as number } : { district: child.district }),
    ...(hasPoint && radiusKm !== undefined ? { radiusKm } : {}),
  };

  const ranked = filterAndRank(await loadCentres(codes), filters);
  return { vaccineCodes: codes, basedOn: hasPoint ? 'LOCATION' : 'DISTRICT', items: ranked.slice(0, limit) };
};

// ---------- managing a centre's vaccines ----------

/** Admin: any facility. Hospital staff: only facilities they are linked to. */
const assertCanManageCentre = async (actor: Actor, facilityId: string): Promise<void> => {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'HOSPITAL_STAFF') {
    const linked = await getLinkedFacilityIds(actor);
    if (linked.includes(facilityId)) return;
  }
  throw new AppError('You can only manage vaccination services of your own facility', 403);
};

export interface CentreVaccineInput {
  vaccineCode: string;
  sessionInfo?: string | null;
}

/** Replace the full list of vaccines a facility offers (what a checkbox list in the UI sends). */
export const setCentreVaccines = async (actor: Actor, facilityId: string, items: CentreVaccineInput[]) => {
  await assertCanManageCentre(actor, facilityId);
  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
  if (!facility) throw new AppError('Facility not found', 404);

  const codes = items.map((i) => i.vaccineCode.trim().toUpperCase());
  if (new Set(codes).size !== codes.length) throw new AppError('A vaccine is listed more than once', 400);

  const vaccines = await prisma.vaccine.findMany({ where: { code: { in: codes }, isActive: true }, select: { id: true, code: true } });
  const idByCode = new Map(vaccines.map((v) => [v.code, v.id]));
  const unknown = codes.filter((c) => !idByCode.has(c));
  if (unknown.length > 0) throw new AppError(`Unknown or inactive vaccine code: ${unknown.join(', ')}`, 400);

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const vaccineId = idByCode.get(item.vaccineCode.trim().toUpperCase()) as string;
      const sessionInfo = cleanText(item.sessionInfo);
      await tx.facilityVaccine.upsert({
        where: { facilityId_vaccineId: { facilityId, vaccineId } },
        create: { facilityId, vaccineId, sessionInfo, isActive: true },
        update: { sessionInfo, isActive: true },
      });
    }
    await tx.facilityVaccine.deleteMany({
      where: { facilityId, vaccineId: { notIn: [...idByCode.values()] } },
    });
  });

  const fresh = await prisma.facility.findUniqueOrThrow({ where: { id: facilityId }, select: centreSelect });
  return toRow(fresh);
};

/** District and PIN code are what centre search filters on. */
export const updateCentreLocation = async (
  actor: Actor,
  facilityId: string,
  body: { district?: string; pinCode?: string }
) => {
  await assertCanManageCentre(actor, facilityId);
  const data: Prisma.FacilityUpdateInput = {};
  if (body.district !== undefined) {
    const v = cleanText(body.district);
    if (!v) throw new AppError('district cannot be empty', 400);
    data.district = v;
  }
  if (body.pinCode !== undefined) {
    const v = cleanText(body.pinCode);
    if (!v) throw new AppError('pinCode cannot be empty', 400);
    data.pinCode = v;
  }
  if (Object.keys(data).length === 0) throw new AppError('Nothing to update', 400);

  const exists = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
  if (!exists) throw new AppError('Facility not found', 404);
  const updated = await prisma.facility.update({ where: { id: facilityId }, data, select: centreSelect });
  return toRow(updated);
};

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter, getLinkedFacilityIds } from './child.access';
import type { Actor } from './child.access';
import { todayInIst } from './vaccination.dates';
import { deriveDoseStatus, generateChildDoses } from './vaccination.schedule';
import type { HistoricalDose, ScheduleEntryInput } from './vaccination.schedule';
import { cleanText, duplicateReasons, formatRecordNumber, toYmd, ymdToDate } from './child.utils';
import type { DuplicateReason } from './child.utils';

// ---------- types ----------

export interface CreateChildBody {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  birthWeightGrams?: number | null;
  motherName: string;
  fatherName: string;
  guardianName?: string | null;
  primaryMobile: string;
  alternateMobile?: string | null;
  email?: string | null;
  addressLine: string;
  village: string;
  district: string;
  state: string;
  pinCode: string;
  latitude?: number | null;
  longitude?: number | null;
  jeEndemicArea?: boolean;
  preferredLanguage?: 'EN' | 'HI';
  smsConsent?: boolean;
  facilityId?: string | null;
  confirmDuplicate?: boolean;
  history?: { vaccineCode: string; doseNumber: number; administeredOn: string }[];
}

export interface DuplicateMatch {
  /** Only given when the requester is allowed to open that record. */
  id: string | null;
  recordNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  village: string;
  district: string;
  matchedOn: DuplicateReason[];
  canView: boolean;
}

const profileInclude = {
  doses: {
    orderBy: [
      { dueDate: 'asc' as const },
      { vaccineCode: 'asc' as const },
      { doseNumber: 'asc' as const },
    ],
  },
  assignedFacility: { select: { id: true, name: true, type: true } },
};

type ChildProfileRow = Prisma.ChildGetPayload<{ include: typeof profileInclude }>;

export type ChildProfile = ReturnType<typeof toProfile>;

export type RegisterChildResult =
  | { status: 'CREATED'; child: ChildProfile }
  | { status: 'INVALID'; errors: string[] }
  | { status: 'POSSIBLE_DUPLICATES'; matches: DuplicateMatch[] };

// ---------- shaping ----------

const toProfile = (c: ChildProfileRow, today: string = todayInIst()) => {
  const doses = c.doses.map((d) => {
    const dueDate = toYmd(d.dueDate);
    return {
      id: d.id,
      vaccineCode: d.vaccineCode,
      vaccineName: d.vaccineName,
      doseNumber: d.doseNumber,
      doseLabel: d.doseLabel,
      ageLabel: d.ageLabel,
      originalDueDate: toYmd(d.originalDueDate),
      dueDate,
      recordedStatus: d.recordedStatus,
      status: deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate }, today),
      administeredOn: d.administeredOn ? toYmd(d.administeredOn) : null,
      isHistorical: d.isHistorical,
      notes: d.notes,
    };
  });
  const count = (s: string) => doses.filter((d) => d.status === s).length;

  return {
    id: c.id,
    recordNumber: formatRecordNumber(c.recordNumber),
    fullName: c.fullName,
    dateOfBirth: toYmd(c.dateOfBirth),
    gender: c.gender,
    birthWeightGrams: c.birthWeightGrams,
    motherName: c.motherName,
    fatherName: c.fatherName,
    guardianName: c.guardianName,
    primaryMobile: c.primaryMobile,
    alternateMobile: c.alternateMobile,
    email: c.email,
    addressLine: c.addressLine,
    village: c.village,
    district: c.district,
    state: c.state,
    pinCode: c.pinCode,
    latitude: c.latitude,
    longitude: c.longitude,
    jeEndemicArea: c.jeEndemicArea,
    preferredLanguage: c.preferredLanguage,
    smsConsent: c.smsConsent,
    smsConsentAt: c.smsConsentAt,
    assignedFacility: c.assignedFacility,
    createdAt: c.createdAt,
    doses,
    summary: {
      total: doses.length,
      administered: count('ADMINISTERED'),
      overdue: count('OVERDUE'),
      due: count('DUE'),
      upcoming: count('UPCOMING'),
      postponed: count('POSTPONED'),
      notGiven: count('NOT_GIVEN'),
    },
  };
};

const required = (value: unknown, label: string): string => {
  const text = cleanText(value);
  if (!text) throw new AppError(`${label} is required`, 400);
  return text;
};

// ---------- helpers ----------

/**
 * Decides which facility a new child is assigned to, and checks the user is
 * allowed to register there.
 *  - A facility the user asked for must be one they are linked to.
 *  - If they did not ask and are linked to exactly one, that one is used.
 *  - Hospital staff must always end up with a facility; a helper may have none yet.
 */
const resolveFacility = async (actor: Actor, requestedId: string | null): Promise<string | null> => {
  if (actor.role === 'HELPER') {
    const helper = await prisma.helperProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (!helper) throw new AppError('Please complete your helper profile before registering children', 403);
  }

  const linked = await getLinkedFacilityIds(actor);
  let facilityId: string | null = null;

  if (requestedId) {
    if (!linked.includes(requestedId)) {
      throw new AppError('You can only register children at a facility you are linked to', 403);
    }
    facilityId = requestedId;
  } else if (linked.length === 1) {
    facilityId = linked[0] ?? null;
  } else if (linked.length > 1) {
    throw new AppError('You are linked to more than one facility. Please choose one (facilityId).', 400);
  } else if (actor.role === 'HOSPITAL_STAFF') {
    throw new AppError('Your account is not linked to a facility yet', 403);
  }

  if (facilityId) {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { isActive: true },
    });
    if (!facility || !facility.isActive) throw new AppError('That facility is not active', 400);
  }
  return facilityId;
};

const loadScheduleEntries = async (): Promise<ScheduleEntryInput[]> => {
  const rows = await prisma.vaccineScheduleEntry.findMany({
    where: { isActive: true, vaccine: { isActive: true } },
    include: { vaccine: { select: { code: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { doseNumber: 'asc' }],
  });
  if (rows.length === 0) throw new AppError('The vaccination schedule has not been set up yet', 503);

  return rows.map((r) => ({
    id: r.id,
    vaccineCode: r.vaccine.code,
    vaccineName: r.vaccine.name,
    doseNumber: r.doseNumber,
    doseLabel: r.doseLabel,
    ageValue: r.ageValue,
    ageUnit: r.ageUnit,
    ageLabel: r.ageLabel,
    applicability: r.applicability,
    sortOrder: r.sortOrder,
  }));
};

/**
 * Children born on the same day whose phone number, parent name or own name
 * match. Only a small summary is returned, never phone numbers or parent
 * names, and the record id only for children the requester may open.
 */
const findPossibleDuplicates = async (
  actor: Actor,
  dob: string,
  probe: { fullName: string; motherName: string; fatherName: string; mobiles: string[] }
): Promise<DuplicateMatch[]> => {
  const sameDay = await prisma.child.findMany({
    where: { dateOfBirth: ymdToDate(dob) },
    select: {
      id: true,
      recordNumber: true,
      fullName: true,
      gender: true,
      village: true,
      district: true,
      motherName: true,
      fatherName: true,
      primaryMobile: true,
      alternateMobile: true,
    },
    take: 500,
  });

  const hits = sameDay
    .map((c) => ({ child: c, reasons: duplicateReasons(c, probe) }))
    .filter((h) => h.reasons.length > 0)
    .slice(0, 10);
  if (hits.length === 0) return [];

  const visible = await prisma.child.findMany({
    where: { AND: [{ id: { in: hits.map((h) => h.child.id) } }, await childAccessFilter(actor)] },
    select: { id: true },
  });
  const visibleIds = new Set(visible.map((v) => v.id));

  return hits.map(({ child, reasons }) => {
    const canView = visibleIds.has(child.id);
    return {
      id: canView ? child.id : null,
      recordNumber: formatRecordNumber(child.recordNumber),
      fullName: child.fullName,
      dateOfBirth: dob,
      gender: child.gender,
      village: child.village,
      district: child.district,
      matchedOn: reasons,
      canView,
    };
  });
};

// ---------- register ----------

export const registerChild = async (actor: Actor, body: CreateChildBody): Promise<RegisterChildResult> => {
  // 1. Permission and facility
  const facilityId = await resolveFacility(actor, cleanText(body.facilityId));

  // 2. Clean the input
  const fullName = required(body.fullName, 'Child name');
  const motherName = required(body.motherName, "Mother's name");
  const fatherName = required(body.fatherName, "Father's name");
  const primaryMobile = required(body.primaryMobile, 'Primary mobile');
  const alternateMobile = cleanText(body.alternateMobile);
  const dob = body.dateOfBirth;
  const jeEndemicArea = body.jeEndemicArea ?? false;
  const smsConsent = body.smsConsent ?? false;

  // 3. Build the schedule and check the date of birth and vaccination history
  const entries = await loadScheduleEntries();
  const history: HistoricalDose[] = (body.history ?? []).map((h) => ({
    vaccineCode: String(h.vaccineCode).trim().toUpperCase(),
    doseNumber: Number(h.doseNumber),
    administeredOn: String(h.administeredOn),
  }));
  const generated = generateChildDoses(
    { dateOfBirth: dob, gender: body.gender, jeEndemicArea },
    entries,
    history,
    todayInIst()
  );
  if (generated.errors.length > 0) return { status: 'INVALID', errors: generated.errors };

  // 4. Possible duplicates: warn, unless the user has already confirmed
  if (!body.confirmDuplicate) {
    const mobiles = [primaryMobile, alternateMobile].filter((m): m is string => !!m);
    const matches = await findPossibleDuplicates(actor, dob, { fullName, motherName, fatherName, mobiles });
    if (matches.length > 0) return { status: 'POSSIBLE_DUPLICATES', matches };
  }

  // 5. Save the child, every dose and the audit rows in ONE transaction
  const doseRows = generated.doses.map((d) => ({ id: randomUUID(), ...d }));

  const saved = await prisma.$transaction(async (tx) => {
    const child = await tx.child.create({
      data: {
        fullName,
        dateOfBirth: ymdToDate(dob),
        gender: body.gender,
        birthWeightGrams: body.birthWeightGrams ?? null,
        motherName,
        fatherName,
        guardianName: cleanText(body.guardianName),
        primaryMobile,
        alternateMobile,
        email: cleanText(body.email),
        addressLine: required(body.addressLine, 'Address'),
        village: required(body.village, 'Village / town'),
        district: required(body.district, 'District'),
        state: required(body.state, 'State'),
        pinCode: required(body.pinCode, 'PIN code'),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        jeEndemicArea,
        preferredLanguage: body.preferredLanguage ?? 'EN',
        smsConsent,
        smsConsentAt: smsConsent ? new Date() : null,
        consentRecordedById: smsConsent ? actor.userId : null,
        assignedFacilityId: facilityId,
        registeredById: actor.userId,
      },
    });

    await tx.childDose.createMany({
      data: doseRows.map((d) => ({
        id: d.id,
        childId: child.id,
        scheduleEntryId: d.scheduleEntryId,
        vaccineCode: d.vaccineCode,
        vaccineName: d.vaccineName,
        doseNumber: d.doseNumber,
        doseLabel: d.doseLabel,
        ageLabel: d.ageLabel,
        originalDueDate: ymdToDate(d.originalDueDate),
        dueDate: ymdToDate(d.dueDate),
        recordedStatus: d.recordedStatus,
        administeredOn: d.administeredOn ? ymdToDate(d.administeredOn) : null,
        administeredFacilityId: null,
        recordedById: d.isHistorical ? actor.userId : null,
        isHistorical: d.isHistorical,
        notes: null,
      })),
    });

    const events = doseRows
      .filter((d) => d.isHistorical)
      .map((d) => ({
        doseId: d.id,
        fromStatus: 'PENDING' as const,
        toStatus: 'ADMINISTERED' as const,
        fromDueDate: null,
        toDueDate: null,
        changedById: actor.userId,
        note: 'Already given before registration (entered when the child was registered)',
      }));
    if (events.length > 0) await tx.childDoseEvent.createMany({ data: events });

    return tx.child.findUniqueOrThrow({ where: { id: child.id }, include: profileInclude });
  });

  return { status: 'CREATED', child: toProfile(saved) };
};

// ---------- read ----------

export const getChildProfile = async (actor: Actor, childId: string): Promise<ChildProfile> => {
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    include: profileInclude,
  });
  // 404 (not 403) so a user cannot find out that someone else's child exists
  if (!child) throw new AppError('Child not found', 404);
  return toProfile(child);
};

export const listChildren = async (actor: Actor, page: number, limit: number) => {
  const where = await childAccessFilter(actor);
  const today = todayInIst();

  const [total, rows] = await prisma.$transaction([
    prisma.child.count({ where }),
    prisma.child.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        recordNumber: true,
        fullName: true,
        dateOfBirth: true,
        gender: true,
        village: true,
        district: true,
        createdAt: true,
        assignedFacility: { select: { id: true, name: true } },
        doses: { select: { dueDate: true, recordedStatus: true } },
      },
    }),
  ]);

  const items = rows.map((c) => {
    const statuses = c.doses.map((d) =>
      deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate: toYmd(d.dueDate) }, today)
    );
    return {
      id: c.id,
      recordNumber: formatRecordNumber(c.recordNumber),
      fullName: c.fullName,
      dateOfBirth: toYmd(c.dateOfBirth),
      gender: c.gender,
      village: c.village,
      district: c.district,
      assignedFacility: c.assignedFacility,
      createdAt: c.createdAt,
      overdueCount: statuses.filter((s) => s === 'OVERDUE').length,
      dueTodayCount: statuses.filter((s) => s === 'DUE').length,
    };
  });

  return { items, total, page, limit };
};

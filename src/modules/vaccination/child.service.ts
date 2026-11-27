import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter, describeChildAccess, getActiveGrants, getLinkedFacilityIds } from './child.access';
import type { Actor, ChildAccessType } from './child.access';
import { grantExpiry } from './child.verify.service';
import { todayInIst } from './vaccination.dates';
import { deriveDoseStatus, generateChildDoses } from './vaccination.schedule';
import type { HistoricalDose, ScheduleEntryInput } from './vaccination.schedule';
import { cleanText, duplicateReasons, formatRecordNumber, toYmd, ymdToDate } from './child.utils';
import type { DuplicateReason } from './child.utils';
import { doseInclude, doseLateness, toPerson } from './dose.view';

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
  /** Where this registration encounter is happening. Never stored on the child. */
  operatingFacilityId?: string | null;
  /** Staff registration requires an explicit guardian-consent attestation. */
  guardianConsentConfirmed?: boolean;
  confirmDuplicate?: boolean;
  history?: { vaccineCode: string; doseNumber: number; administeredOn: string }[];
}

export interface DuplicateMatch {
  /**
   * Identity fields are returned ONLY when the requester may already open that
   * record. Otherwise they are null: duplicate detection warns without leaking
   * another worker's child name, record number, date of birth or address.
   */
  id: string | null;
  recordNumber: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  village: string | null;
  district: string | null;
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
    include: doseInclude,
  },
  registeredBy: {
    select: { id: true, email: true, role: true, helperProfile: { select: { fullName: true } } },
  },
};

type ChildProfileRow = Prisma.ChildGetPayload<{ include: typeof profileInclude }>;

export type ChildProfile = ReturnType<typeof toProfile>;
export type ChildProfileWithAccess = ChildProfile & {
  accessType: ChildAccessType;
  accessExpiresAt: Date | null;
};

export type RegisterChildResult =
  | { status: 'CREATED'; child: ChildProfile }
  | { status: 'INVALID'; errors: string[] }
  | { status: 'POSSIBLE_DUPLICATES'; matches: DuplicateMatch[] };

// ---------- shaping ----------

const toProfile = (c: ChildProfileRow, today: string = todayInIst()) => {
  const doses = c.doses.map((d) => {
    const dueDate = toYmd(d.dueDate);
    const administeredOn = d.administeredOn ? toYmd(d.administeredOn) : null;
    const lateness = doseLateness(dueDate, administeredOn);
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
      administeredOn,
      administeredFacility: d.administeredFacility,
      recordedBy: toPerson(d.recordedBy),
      wasLate: lateness.wasLate,
      daysLate: lateness.daysLate,
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
    registeredBy: toPerson(c.registeredBy),
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
 * The facility of THIS registration encounter. It is validated and used for the
 * registration audit and the registering staff member's temporary grant; it is
 * never written on the child and creates no ownership.
 *
 *  - A facility the user asked for must be one they are linked to and active.
 *  - If they did not ask and are linked to exactly one, that one is used.
 *  - Hospital staff linked to several facilities must choose one.
 *  - A helper may have no linked facility; the registration still succeeds.
 */
const resolveOperatingFacility = async (
  actor: Actor,
  requestedId: string | null
): Promise<string | null> => {
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
  } else if (actor.role === 'HOSPITAL_STAFF') {
    if (linked.length === 0) throw new AppError('Your account is not linked to a facility yet', 403);
    throw new AppError(
      'You are linked to more than one facility. Choose the facility where you are registering this child (operatingFacilityId).',
      400
    );
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
    if (!canView) {
      // Warn about the possible duplicate without exposing any identity data.
      return {
        id: null,
        recordNumber: null,
        fullName: null,
        dateOfBirth: null,
        gender: null,
        village: null,
        district: null,
        matchedOn: reasons,
        canView: false,
      };
    }
    return {
      id: child.id,
      recordNumber: formatRecordNumber(child.recordNumber),
      fullName: child.fullName,
      dateOfBirth: dob,
      gender: child.gender,
      village: child.village,
      district: child.district,
      matchedOn: reasons,
      canView: true,
    };
  });
};

// ---------- register ----------

export const registerChild = async (actor: Actor, body: CreateChildBody): Promise<RegisterChildResult> => {
  // 1. Permission and the operating facility of this encounter
  const operatingFacilityId = await resolveOperatingFacility(
    actor,
    cleanText(body.operatingFacilityId)
  );
  if (actor.role === 'HOSPITAL_STAFF' && body.guardianConsentConfirmed !== true) {
    throw new AppError(
      'Confirm that the guardian consents to this vaccination record being created',
      422
    );
  }

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
        // The administering facility of a historical dose is unknown unless the
        // data says otherwise; it is never guessed from where it was typed in.
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
        // This event records data entry at registration, not an administration
        // that happened here: the encounter facility stays unknown.
        facilityId: null,
        changedById: actor.userId,
        note: 'Already given before registration (entered when the child was registered)',
      }));
    if (events.length > 0) await tx.childDoseEvent.createMany({ data: events });

    // D2: a staff registration issues a normal temporary grant at the operating
    // facility, in the same transaction. No access exists without it.
    if (actor.role === 'HOSPITAL_STAFF' && operatingFacilityId) {
      const expiresAt = grantExpiry();
      await tx.childAccessGrant.create({
        data: {
          childId: child.id,
          userId: actor.userId,
          facilityId: operatingFacilityId,
          verificationMethod: 'MANUAL_ATTESTED',
          expiresAt,
        },
      });
      await tx.childAccessAudit.create({
        data: {
          childId: child.id,
          actorId: actor.userId,
          facilityId: operatingFacilityId,
          action: 'REGISTRATION_GRANT_ISSUED',
          detail: { expiresAt: expiresAt.toISOString(), guardianConsentConfirmed: true },
        },
      });
    }

    return tx.child.findUniqueOrThrow({ where: { id: child.id }, include: profileInclude });
  });

  return { status: 'CREATED', child: toProfile(saved) };
};

// ---------- read ----------

export const getChildProfile = async (actor: Actor, childId: string): Promise<ChildProfileWithAccess> => {
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    include: profileInclude,
  });
  // 404 (not 403) so a user cannot find out that someone else's child exists
  if (!child) throw new AppError('Child not found', 404);

  const access = await describeChildAccess(actor, { id: child.id });
  return { ...toProfile(child), accessType: access.accessType, accessExpiresAt: access.accessExpiresAt };
};

export const listChildren = async (actor: Actor, page: number, limit: number) => {
  const where = await childAccessFilter(actor);
  const today = todayInIst();
  // Staff list rows are all grant-backed; the expiry tells the UI how long the
  // row will remain visible.
  const grantExpiryByChild = new Map<string, Date>();
  if (actor.role === 'HOSPITAL_STAFF') {
    for (const grant of await getActiveGrants(actor)) grantExpiryByChild.set(grant.childId, grant.expiresAt);
  }

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
      accessType: actor.role === 'HELPER' ? ('OWN' as const) : grantExpiryByChild.has(c.id) ? ('VERIFIED' as const) : ('NONE' as const),
      accessExpiresAt: grantExpiryByChild.get(c.id) ?? null,
      createdAt: c.createdAt,
      overdueCount: statuses.filter((s) => s === 'OVERDUE').length,
      dueTodayCount: statuses.filter((s) => s === 'DUE').length,
    };
  });

  return { items, total, page, limit };
};

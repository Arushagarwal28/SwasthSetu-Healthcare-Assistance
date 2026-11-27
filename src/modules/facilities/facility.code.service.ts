/**
 * Facility registration codes.
 *
 * A code is an invitation credential: it identifies exactly one facility so a
 * new HOSPITAL_STAFF account is linked to the right place at registration.
 * Only a keyed HMAC of the code is stored, so the database (or a backup of it)
 * never reveals a usable code, while lookup stays a single indexed query.
 */
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

export type CodeDb = Prisma.TransactionClient;

/** Production custom codes: long enough that guessing is impractical. */
export const CUSTOM_CODE_MIN_LENGTH = 12;
export const CODE_MAX_LENGTH = 32;
/**
 * Floor for *accepting* a submitted code at registration. Codes issued before
 * the 12-character policy keep working, so existing staff links are never
 * silently invalidated; this floor only applies to the registration lookup.
 */
export const CODE_MIN_LENGTH = 6;

/** Extra complexity rules beyond length, letters and digits. */
const MIN_DISTINCT_CHARACTERS = 6;
const MAX_CHARACTER_RUN = 3;
const MAX_REPEATING_BLOCK = 6;

/** Crockford-style alphabet: no I, L, O, U, 0 or 1, so codes are easy to read out. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const GENERATED_LENGTH = 12;
const GENERATED_ATTEMPTS = 5;

/** The single message every rejected code gets, so the reason is never revealed. */
export const INVALID_CODE_MESSAGE = 'Invalid or expired facility registration code';

/**
 * Canonical form used for hashing: upper case, no spaces or dashes. So
 * "HOSP-123", "hosp 123" and "HOSP123" are the same code.
 */
export const normalizeFacilityCode = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');

const pepper = (): string => {
  const value = process.env.FACILITY_CODE_PEPPER;
  if (!value || value.trim() === '') {
    // Fail closed: without the key no code can be created or verified.
    throw new AppError('Facility registration is not configured on this server', 503);
  }
  return value;
};

/** Keyed, non-reversible lookup value. Never store or log the plaintext code. */
export const hashFacilityCode = (canonical: string): string =>
  crypto.createHmac('sha256', pepper()).update(canonical).digest('hex');

/**
 * Custom (human-chosen) codes must be at least 12 characters with both letters
 * and digits, and must not be trivially guessable: short example codes such as
 * HOSP123, PHC123 and CHC123 are rejected here. Generated codes use 12 random
 * characters from an unambiguous alphabet and are unaffected by this policy.
 *
 * There is deliberately no test-only bypass: integration tests use codes that
 * satisfy the same production rules.
 */
export const assertCustomCodePolicy = (canonical: string): void => {
  if (canonical.length < CUSTOM_CODE_MIN_LENGTH || canonical.length > CODE_MAX_LENGTH) {
    throw new AppError(
      `A facility registration code must be ${CUSTOM_CODE_MIN_LENGTH} to ${CODE_MAX_LENGTH} characters long`,
      400
    );
  }
  if (!/^[A-Z0-9]+$/.test(canonical)) {
    throw new AppError('A facility registration code may contain only letters and digits', 400);
  }
  if (!/[A-Z]/.test(canonical) || !/[0-9]/.test(canonical)) {
    throw new AppError('A facility registration code must contain both letters and digits', 400);
  }
  if (new Set(canonical).size < MIN_DISTINCT_CHARACTERS) {
    throw new AppError(
      `A facility registration code must use at least ${MIN_DISTINCT_CHARACTERS} different characters`,
      400
    );
  }
  if (new RegExp(`(.)\\1{${MAX_CHARACTER_RUN},}`).test(canonical)) {
    throw new AppError(
      `A facility registration code must not repeat one character more than ${MAX_CHARACTER_RUN} times in a row`,
      400
    );
  }
  for (let size = 1; size <= MAX_REPEATING_BLOCK; size += 1) {
    if (canonical.length % size !== 0 || size === canonical.length) continue;
    if (canonical.slice(0, size).repeat(canonical.length / size) === canonical) {
      throw new AppError('A facility registration code must not be a repeated pattern', 400);
    }
  }
};

/** 12 random characters, shown grouped for reading aloud: ABCD-EFGH-JKMN. */
export const generateFacilityCode = (): string => {
  let raw = '';
  for (let i = 0; i < GENERATED_LENGTH; i += 1) {
    raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

// ---------- status and metadata ----------

export type RegistrationCodeStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface RegistrationCodeSummary {
  status: RegistrationCodeStatus;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

interface CodeRowLike {
  status: 'ACTIVE' | 'REVOKED';
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export const codeStatus = (row: CodeRowLike, now: Date = new Date()): RegistrationCodeStatus => {
  if (row.status === 'REVOKED') return 'REVOKED';
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'ACTIVE';
};

const toSummary = (row: CodeRowLike): RegistrationCodeSummary => ({
  status: codeStatus(row),
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
});

/** The latest code of every facility, for the admin screen. Never the code itself. */
export const getRegistrationCodeSummaries = async (
  facilityIds: string[]
): Promise<Map<string, RegistrationCodeSummary>> => {
  const map = new Map<string, RegistrationCodeSummary>();
  if (facilityIds.length === 0) return map;

  const rows = await prisma.facilityRegistrationCode.findMany({
    where: { facilityId: { in: facilityIds } },
    orderBy: { createdAt: 'desc' },
    select: { facilityId: true, status: true, createdAt: true, expiresAt: true, revokedAt: true },
  });
  for (const row of rows) {
    if (!map.has(row.facilityId)) map.set(row.facilityId, toSummary(row));
  }
  return map;
};

// ---------- lifecycle ----------

export interface IssuedCode {
  code: string;
  expiresAt: Date | null;
}

interface IssueInput {
  facilityId: string;
  actorId: string;
  customCode?: string | null;
  expiresAt?: Date | null;
}

const assertFacilityExists = async (db: CodeDb, facilityId: string): Promise<void> => {
  const facility = await db.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
  if (!facility) throw new AppError('Facility not found', 404);
};

const assertExpirySane = (expiresAt: Date | null | undefined): Date | null => {
  if (!expiresAt) return null;
  if (Number.isNaN(expiresAt.getTime())) throw new AppError('expiresAt must be a valid date', 400);
  if (expiresAt.getTime() <= Date.now()) throw new AppError('The expiry date must be in the future', 400);
  return expiresAt;
};

const audit = async (
  db: CodeDb,
  values: {
    facilityId: string;
    codeId?: string | null;
    actorId: string | null;
    action: 'CREATED' | 'ROTATED' | 'REVOKED' | 'EXPIRY_CHANGED' | 'REGISTRATION_USED';
    detail?: Prisma.InputJsonValue;
  }
): Promise<void> => {
  await db.facilityCodeAudit.create({
    data: {
      facilityId: values.facilityId,
      codeId: values.codeId ?? null,
      actorId: values.actorId,
      action: values.action,
      ...(values.detail === undefined ? {} : { detail: values.detail }),
    },
  });
};

const insertCode = async (db: CodeDb, input: IssueInput): Promise<IssuedCode> => {
  const custom = input.customCode ? normalizeFacilityCode(input.customCode) : null;
  if (custom) assertCustomCodePolicy(custom);

  const expiresAt = assertExpirySane(input.expiresAt ?? null);

  for (let attempt = 0; attempt < (custom ? 1 : GENERATED_ATTEMPTS); attempt += 1) {
    const plaintext = custom ?? generateFacilityCode();
    try {
      await db.facilityRegistrationCode.create({
        data: {
          facilityId: input.facilityId,
          // Always the canonical form: generated codes are displayed with dashes
          // but must hash to the same value the registration form produces.
          codeLookup: hashFacilityCode(normalizeFacilityCode(plaintext)),
          createdById: input.actorId,
          expiresAt,
        },
      });
      return { code: plaintext, expiresAt };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002' && !custom) continue; // generated collision: try another
      if (code === 'P2002') throw new AppError('That code is already in use. Choose another one.', 409);
      throw err;
    }
  }
  throw new AppError('Could not generate a unique code. Please try again.', 503);
};

const activeCode = async (db: CodeDb, facilityId: string) =>
  db.facilityRegistrationCode.findFirst({
    where: { facilityId, status: 'ACTIVE' },
    select: { id: true, expiresAt: true },
  });

/** Creates the first active code for a facility inside the caller's transaction. */
export const createFirstCodeInTx = async (db: CodeDb, input: IssueInput): Promise<IssuedCode> => {
  await assertFacilityExists(db, input.facilityId);
  if (await activeCode(db, input.facilityId)) {
    throw new AppError('This facility already has an active registration code. Rotate it instead.', 409);
  }
  const issued = await insertCode(db, input);
  await audit(db, {
    facilityId: input.facilityId,
    actorId: input.actorId,
    action: 'CREATED',
    detail: expiryDetail(issued.expiresAt),
  });
  return issued;
};

/** Creates the facility's first active code. Refuses when one is already active. */
export const createRegistrationCode = async (input: IssueInput): Promise<IssuedCode> => {
  return prisma.$transaction((tx) => createFirstCodeInTx(tx, input));
};

/** Revokes the current code and issues a new one. Staff links are untouched. */
export const rotateRegistrationCode = async (input: IssueInput): Promise<IssuedCode> => {
  return prisma.$transaction(async (tx) => {
    await assertFacilityExists(tx, input.facilityId);
    const current = await activeCode(tx, input.facilityId);
    if (current) {
      await tx.facilityRegistrationCode.update({
        where: { id: current.id },
        data: { status: 'REVOKED', revokedAt: new Date(), revokedById: input.actorId },
      });
    }
    const issued = await insertCode(tx, input);
    await audit(tx, {
      facilityId: input.facilityId,
      codeId: current?.id ?? null,
      actorId: input.actorId,
      action: 'ROTATED',
      detail: expiryDetail(issued.expiresAt),
    });
    return issued;
  });
};

export const revokeRegistrationCode = async (facilityId: string, actorId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const current = await activeCode(tx, facilityId);
    if (!current) throw new AppError('This facility has no active registration code', 404);
    await tx.facilityRegistrationCode.update({
      where: { id: current.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedById: actorId },
    });
    await audit(tx, { facilityId, codeId: current.id, actorId, action: 'REVOKED' });
  });
};

export const setRegistrationCodeExpiry = async (
  facilityId: string,
  actorId: string,
  expiresAt: Date | null
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const current = await activeCode(tx, facilityId);
    if (!current) throw new AppError('This facility has no active registration code', 404);
    const value = assertExpirySane(expiresAt);
    await tx.facilityRegistrationCode.update({ where: { id: current.id }, data: { expiresAt: value } });
    await audit(tx, {
      facilityId,
      codeId: current.id,
      actorId,
      action: 'EXPIRY_CHANGED',
      detail: expiryDetail(value),
    });
  });
};

const expiryDetail = (expiresAt: Date | null): Prisma.InputJsonValue => ({
  expiresAt: expiresAt ? expiresAt.toISOString() : null,
});

// ---------- registration ----------

export interface ResolvedCode {
  codeId: string;
  facility: { id: string; name: string };
}

/**
 * Validates a submitted code inside the caller's transaction and returns its
 * facility. Every rejection is the same generic 403, so a caller cannot learn
 * whether a code exists, was revoked, expired or belongs to an inactive facility.
 * Must be called inside the registration transaction: no code value is logged.
 */
export const resolveFacilityCodeForRegistration = async (
  db: CodeDb,
  rawCode: string
): Promise<ResolvedCode> => {
  const canonical = normalizeFacilityCode(rawCode);
  // CODE_MIN_LENGTH (not the creation policy): codes issued under the earlier
  // 6-character policy remain usable, so no account loses its facility link.
  if (canonical.length < CODE_MIN_LENGTH || canonical.length > CODE_MAX_LENGTH) {
    throw new AppError(INVALID_CODE_MESSAGE, 403);
  }

  const row = await db.facilityRegistrationCode.findUnique({
    where: { codeLookup: hashFacilityCode(canonical) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      facility: { select: { id: true, name: true, isActive: true } },
    },
  });

  const expired = row?.expiresAt ? row.expiresAt.getTime() <= Date.now() : false;
  if (!row || row.status !== 'ACTIVE' || expired || !row.facility.isActive) {
    throw new AppError(INVALID_CODE_MESSAGE, 403);
  }

  return { codeId: row.id, facility: { id: row.facility.id, name: row.facility.name } };
};

/** Marks a code as used. Called inside the registration transaction. */
export const recordCodeUsage = async (db: CodeDb, codeId: string, userId: string): Promise<void> => {
  const row = await db.facilityRegistrationCode.update({
    where: { id: codeId },
    data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
    select: { facilityId: true },
  });
  await audit(db, {
    facilityId: row.facilityId,
    codeId,
    actorId: userId,
    action: 'REGISTRATION_USED',
  });
};

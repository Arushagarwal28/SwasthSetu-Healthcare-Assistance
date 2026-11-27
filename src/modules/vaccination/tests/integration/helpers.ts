/**
 * Shared harness for the facility-code and cross-facility vaccination
 * integration tests.
 *
 * Everything is synthetic: unique emails, facility names and mobile numbers
 * carry a per-process prefix, and cleanup removes only the rows this process
 * created. Existing users, facilities and children are never read for their
 * content, updated or deleted.
 */
import './test-env';
import { once } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../../../app';
import { prisma } from '../../../../config/prisma';
import { formatRecordNumber } from '../../child.utils';

export const PREFIX = `it-vax-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface Harness {
  apiUrl: string;
  close: () => Promise<void>;
}

/** Starts the real Express app on an ephemeral loopback port. */
export const startHarness = async (): Promise<Harness> => {
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;

  return {
    apiUrl: `http://127.0.0.1:${port}/api/v1`,
    close: async () => {
      // fetch keeps HTTP keep-alive sockets open; without closing them,
      // server.close() can wait indefinitely and the test process never exits.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    },
  };
};

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export async function api<T = any>(
  harness: Harness,
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let payload: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(options.body);
  }

  const response = await fetch(`${harness.apiUrl}${endpoint}`, {
    method: options.method ?? 'GET',
    headers,
    ...(payload ? { body: payload } : {}),
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON responses are returned as text.
  }
  return { status: response.status, body: body as T };
}

export const tokenFor = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET as string, { expiresIn: '1h' });

const passwordHash = bcrypt.hashSync('Synthetic@1234', 4);

const created = {
  userIds: [] as string[],
  facilityIds: [] as string[],
  childIds: [] as string[],
};

export const track = {
  user(id: string): string {
    created.userIds.push(id);
    return id;
  },
  facility(id: string): string {
    created.facilityIds.push(id);
    return id;
  },
  child(id: string): string {
    created.childIds.push(id);
    return id;
  },
};

export const createUser = async (
  role: 'ADMIN' | 'HOSPITAL_STAFF' | 'HELPER' | 'PATIENT',
  label: string
) => {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${label}@example.test`, passwordHash, role },
  });
  track.user(user.id);
  return user;
};

export const createFacility = async (
  label: string,
  type: 'PHC' | 'CHC' | 'HOSPITAL' | 'CLINIC' | 'OTHER' = 'PHC',
  overrides: { name?: string } = {}
) => {
  const facility = await prisma.facility.create({
    data: {
      name: overrides.name ?? `${PREFIX} ${label}`,
      type,
      address: 'Synthetic test address',
    },
  });
  track.facility(facility.id);
  return facility;
};

export const linkStaff = (userId: string, facilityId: string) =>
  prisma.hospitalStaffFacilityLink.create({ data: { userId, facilityId } });

let mobileCounter = 0;

/** A valid 10-digit Indian mobile that is unique within this process. */
export const syntheticMobile = (): string => {
  mobileCounter += 1;
  const tail = String(Date.now()).slice(-6);
  return `9${tail}${String(100 + mobileCounter).slice(-3)}`;
};

export interface SyntheticChild {
  id: string;
  recordNumber: string;
  mobile: string;
}

export interface SyntheticDose {
  code: string;
  number: number;
  dueDate: string;
}

/**
 * Creates a child and its doses directly, so the suite does not depend on the
 * seeded vaccination schedule. Doses start PENDING with a past due date.
 */
export const createChildWithDoses = async (options: {
  label: string;
  registeredById: string;
  doses?: SyntheticDose[];
  dateOfBirth?: string;
}): Promise<SyntheticChild> => {
  const mobile = syntheticMobile();
  const dateOfBirth = options.dateOfBirth ?? '2024-01-15';
  const doses =
    options.doses ??
    [
      { code: 'BCG', number: 1, dueDate: '2026-01-15' },
      { code: 'OPV', number: 1, dueDate: '2026-01-15' },
      { code: 'HEPB', number: 1, dueDate: '2026-02-15' },
      { code: 'PENTA', number: 1, dueDate: '2026-03-15' },
      { code: 'PCV', number: 1, dueDate: '2026-04-15' },
    ];

  const child = await prisma.child.create({
    data: {
      fullName: `${PREFIX} Child ${options.label}`,
      dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
      gender: 'MALE',
      motherName: 'Synthetic Mother',
      fatherName: 'Synthetic Father',
      primaryMobile: mobile,
      addressLine: 'Synthetic test address',
      village: 'Synthetic village',
      district: 'Synthetic district',
      state: 'Synthetic state',
      pinCode: '000000',
      // No facility on the child: the registry is centralized and the facility
      // belongs to individual events only.
      registeredById: options.registeredById,
    },
  });
  track.child(child.id);

  await prisma.childDose.createMany({
    data: doses.map((dose) => ({
      childId: child.id,
      vaccineCode: dose.code,
      vaccineName: `Synthetic ${dose.code}`,
      doseNumber: dose.number,
      doseLabel: `${dose.code} ${dose.number}`,
      ageLabel: 'At birth',
      originalDueDate: new Date(`${dose.dueDate}T00:00:00.000Z`),
      dueDate: new Date(`${dose.dueDate}T00:00:00.000Z`),
      recordedStatus: 'PENDING',
    })),
  });

  return { id: child.id, recordNumber: formatRecordNumber(child.recordNumber), mobile };
};

/**
 * Removes only the rows this process created. Children go first (which cascades
 * to doses, dose events and access grants), then facilities, then users.
 * Access audits are deleted explicitly because their child/facility foreign
 * keys are SetNull, so they would otherwise survive their subject.
 */
export const cleanupAll = async (): Promise<void> => {
  const { userIds, facilityIds, childIds } = created;

  if (childIds.length > 0) {
    await prisma.childAccessAudit.deleteMany({
      where: {
        OR: [
          { childId: { in: childIds } },
          ...(userIds.length > 0 ? [{ actorId: { in: userIds } }] : []),
        ],
      },
    });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
  }

  // Children created through the API are not in `childIds` (the API generates
  // their ids). Every child registered by a synthetic test user is synthetic
  // too, so remove them before their registering user.
  if (userIds.length > 0) {
    await prisma.child.deleteMany({ where: { registeredById: { in: userIds } } });
  }

  if (facilityIds.length > 0) {
    await prisma.facility.deleteMany({ where: { id: { in: facilityIds } } });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
};

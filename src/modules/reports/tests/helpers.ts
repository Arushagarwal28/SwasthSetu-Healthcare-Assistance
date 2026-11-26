/**
 * Shared helpers for the Medical Report Simplifier integration tests.
 *
 * Everything here creates *synthetic* data with a unique prefix and removes it
 * again afterwards. Existing patients, reports and users are never touched.
 */
import './test-env';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { prisma } from '../../../config/prisma';
import { closePdfRenderer } from '../report.export.service';

const fixtureFile = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

export const fixtures = {
  parse: fixtureFile('cbc.parse.json'),
  explain: fixtureFile('cbc.explain.json'),
  correct: fixtureFile('cbc.correct.json'),
};

export interface MockState {
  mode: 'ok' | 'error' | 'timeout' | 'invalid';
  delayMs: number;
}

export const mockState: MockState = { mode: 'ok', delayMs: 0 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Harness {
  apiUrl: string;
  close: () => Promise<void>;
}

export interface Actors {
  patientToken: string;
  otherPatientToken: string;
  helperToken: string;
  staffToken: string;
  otherStaffToken: string;
  adminToken: string;
  patientId: string;
  otherPatientId: string;
  helperUserId: string;
  staffUserId: string;
  otherStaffUserId: string;
  /** Remove everything this test created. */
  cleanup: () => Promise<void>;
}

const PREFIX = `rpt-test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function startHarness(): Promise<Harness> {
  const mock = http.createServer(async (req, res) => {
    for await (const _chunk of req) {
      // Drain the body; content is never inspected or logged.
    }

    if (mockState.mode === 'error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"success":false,"error":{"code":"ocr_failed"}}');
      return;
    }
    if (mockState.mode === 'invalid') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"success":true}');
      return;
    }
    if (mockState.mode === 'timeout') {
      await sleep(mockState.delayMs);
    }

    const json = (payload: unknown) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    if (req.url === '/parse') {
      json(fixtures.parse);
      return;
    }
    if (req.url === '/explain') {
      json({
        success: true,
        provider: 'rule-based',
        languages: ['en', 'hi'],
        explanations: fixtures.explain,
      });
      return;
    }
    if (req.url === '/correct') {
      json({
        success: true,
        provider: 'rule-based',
        tests: fixtures.correct.tests,
        applied: fixtures.correct.applied,
        applied_count: fixtures.correct.applied.length,
        warnings: [],
        explanations: fixtures.correct.explanations,
      });
      return;
    }
    if (req.url === '/health') {
      json({ status: 'ok' });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  const mockPort = (mock.address() as AddressInfo).port;
  if (process.env.MEDICAL_REPORT_LIVE_PYTHON !== '1') {
    process.env.MEDICAL_REPORT_SERVICE_URL = `http://127.0.0.1:${mockPort}`;
  }

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const apiPort = (server.address() as AddressInfo).port;

  return {
    apiUrl: `http://127.0.0.1:${apiPort}/api/v1/reports`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await new Promise<void>((resolve) => mock.close(() => resolve()));
      await closePdfRenderer();
      await prisma.$disconnect();
    },
  };
}

const tokenFor = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET as string, { expiresIn: '1h' });

const passwordHash = bcrypt.hashSync('Synthetic@1234', 4);

export async function seedActors(): Promise<Actors> {
  const createdUserIds: string[] = [];

  const makeUser = async (role: 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN', label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}-${label}@example.test`,
        passwordHash,
        role,
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  const makePatient = async (roleLabel: string) => {
    const user = await makeUser('PATIENT', roleLabel);
    const patient = await prisma.patient.create({
      data: {
        userId: user.id,
        fullName: `Synthetic Patient ${roleLabel}`,
        dateOfBirth: new Date('1990-01-01'),
        gender: 'other',
      },
    });
    return { user, patient };
  };

  const patient = await makePatient('patient');
  const otherPatient = await makePatient('other');

  const helperUser = await makeUser('HELPER', 'helper');
  const helperProfile = await prisma.helperProfile.create({
    data: {
      userId: helperUser.id,
      fullName: 'Synthetic Helper',
    },
  });
  await prisma.patientHelperLink.create({
    data: { patientId: patient.patient.id, helperId: helperProfile.id },
  });

  const staffUser = await makeUser('HOSPITAL_STAFF', 'staff');
  const otherStaffUser = await makeUser('HOSPITAL_STAFF', 'staff2');
  const adminUser = await makeUser('ADMIN', 'admin');

  return {
    patientToken: tokenFor(patient.user.id, 'PATIENT'),
    otherPatientToken: tokenFor(otherPatient.user.id, 'PATIENT'),
    helperToken: tokenFor(helperUser.id, 'HELPER'),
    staffToken: tokenFor(staffUser.id, 'HOSPITAL_STAFF'),
    otherStaffToken: tokenFor(otherStaffUser.id, 'HOSPITAL_STAFF'),
    adminToken: tokenFor(adminUser.id, 'ADMIN'),
    patientId: patient.patient.id,
    otherPatientId: otherPatient.patient.id,
    helperUserId: helperUser.id,
    staffUserId: staffUser.id,
    otherStaffUserId: otherStaffUser.id,
    cleanup: async () => {
      const patients = [patient.patient.id, otherPatient.patient.id];
      await prisma.medicalReport.deleteMany({ where: { patientId: { in: patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: patients } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    },
  };
}

export const pdfBuffer = (size = 64): Buffer =>
  Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(Math.max(0, size - 9), 0x20)]);

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function api<T = any>(
  harness: Harness,
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown; form?: FormData } = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let payload: BodyInit | undefined;
  if (options.form) {
    payload = options.form;
  } else if (options.body !== undefined) {
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
    // Non-JSON (the PDF export) is returned as text.
  }

  return { status: response.status, body: body as T, headers: response.headers };
}

export function uploadForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from(pdfBuffer())], { type: 'application/pdf' }), 'cbc.pdf');
  for (const [key, value] of Object.entries(overrides)) {
    form.append(key, value);
  }
  return form;
}

export async function uploadReport(
  harness: Harness,
  token: string,
  overrides: Record<string, string> = {}
): Promise<ApiResponse> {
  return api(harness, '/', { method: 'POST', token, form: uploadForm(overrides) });
}

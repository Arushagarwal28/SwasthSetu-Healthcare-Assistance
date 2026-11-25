/**
 * Vaccination tracker API client.
 *
 * Every call goes through the shared axiosClient, so:
 *  - the access token is attached automatically,
 *  - a 401 triggers the existing single-flight refresh,
 *  - a failed refresh clears the session and redirects to /login.
 *
 * The backend always answers with { success, data } and, on failure, either
 * the standard { success: false, error: { message, details } } envelope or one
 * of the vaccination-specific envelopes handled by describeVaccinationError().
 */
import axiosClient from './axiosClient';
import { getApiErrorMessage } from '../utils/errors';
import type {
  AdminStats,
  Centre,
  CentreSearchQuery,
  CentreSearchResponse,
  CentreVaccineInput,
  ChildCentresQuery,
  ChildCentresResponse,
  ChildDashboard,
  ChildDuplicateMatch,
  ChildHistoryQuery,
  ChildHistoryResponse,
  ChildListQuery,
  ChildListResponse,
  ChildProfile,
  ChildReminder,
  CreateScheduleEntryInput,
  CreateVaccineInput,
  NotificationListResponse,
  NotificationsQuery,
  RecordDoseInput,
  RegisterChildInput,
  ScheduleEntryResult,
  ScheduleVaccine,
  UpdateCentreLocationInput,
  UpdateChildInput,
  UpdateScheduleEntryInput,
  UpdateVaccineInput,
  VaccineResult,
  WorklistQuery,
  WorklistResponse,
  ChildrenPage,
  DuplicateChildMatch,
  FacilityOption,
  VaccineScheduleView,
  ChildDashboardDose,
} from '../types/vaccination';

/** Turns `string | string[]` into the comma-separated form the API expects. */
const csv = (value?: string | string[]): string | undefined => {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(',') : value;
};

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export interface VaccinationErrorDetails {
  /** A message that is safe and useful to show a user. */
  message: string;
  /** 'POSSIBLE_DUPLICATES', 'INVALID_CHILD_DATA', or any other code the API sent. */
  code: string | null;
  /** Per-field / per-problem messages from express-validator or the schedule rules. */
  fieldErrors: string[];
  /** Populated only for a 409 POSSIBLE_DUPLICATES response. */
  duplicateMatches: ChildDuplicateMatch[];
}

interface ErrorResponseBody {
  code?: string;
  message?: string;
  errors?: unknown;
  data?: { matches?: unknown };
  error?: { message?: string; details?: { message?: string }[] };
}

/**
 * Reads every shape the vaccination API can fail with, so callers do not have
 * to know about the envelopes. Use this instead of `err.response.data` directly.
 */
export const describeVaccinationError = (
  err: unknown,
  fallback: string,
): VaccinationErrorDetails => {
  const body = (err as { response?: { data?: ErrorResponseBody } }).response?.data;

  const fieldErrors = Array.isArray(body?.errors)
    ? body.errors.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
    : (body?.error?.details ?? [])
        .map((d) => d.message)
        .filter((m): m is string => typeof m === 'string' && m.trim() !== '');

  const literalMatches = Array.isArray(body?.data?.matches)
    ? (body.data.matches as ChildDuplicateMatch[])
    : [];

  return {
    message: fieldErrors[0] ?? getApiErrorMessage(err, fallback),
    code: typeof body?.code === 'string' ? body.code : null,
    fieldErrors,
    duplicateMatches: literalMatches,
  };
};

/** True when registration was refused because a similar child already exists. */
export const isDuplicateRegistration = (err: unknown): boolean =>
  describeVaccinationError(err, '').code === 'POSSIBLE_DUPLICATES';

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

/** POST /children - 201 with the profile, 409 duplicates, 400 validation errors. */
export const registerChild = async (input: RegisterChildInput): Promise<ChildProfile> => {
  const res = await axiosClient.post('/children', input);
  return res.data.data as ChildProfile;
};

/** GET /children - page/limit only; search is done in the browser. */
export const listChildren = async (params: ChildListQuery = {}): Promise<ChildListResponse> => {
  const res = await axiosClient.get('/children', {
    params: { page: params.page, limit: params.limit },
  });
  return res.data.data as ChildListResponse;
};

/** GET /children/:id - full profile including every dose. */
export const getChild = async (childId: string): Promise<ChildProfile> => {
  const res = await axiosClient.get(`/children/${childId}`);
  return res.data.data as ChildProfile;
};

/** PATCH /children/:id - contact and address fields only. */
export const updateChild = async (
  childId: string,
  input: UpdateChildInput,
): Promise<ChildProfile> => {
  const res = await axiosClient.patch(`/children/${childId}`, input);
  return res.data.data as ChildProfile;
};

/** GET /children/:id/dashboard - summary, overdue/due/upcoming/completed, next visit, activity. */
export const getChildDashboard = async (childId: string): Promise<ChildDashboard> => {
  const res = await axiosClient.get(`/children/${childId}/dashboard`);
  return res.data.data as ChildDashboard;
};

/** GET /children/:id/history - the audit trail, newest first. */
export const getChildHistory = async (
  childId: string,
  params: ChildHistoryQuery = {},
): Promise<ChildHistoryResponse> => {
  const res = await axiosClient.get(`/children/${childId}/history`, {
    params: { page: params.page, limit: params.limit },
  });
  return res.data.data as ChildHistoryResponse;
};

/** GET /children/:id/reminders - scheduled reminders with every delivery attempt. */
export const getChildReminders = async (
  childId: string,
  limit?: number,
): Promise<ChildReminder[]> => {
  const res = await axiosClient.get(`/children/${childId}/reminders`, {
    params: { limit },
  });
  return res.data.data as ChildReminder[];
};

/** GET /children/:id/centres - centres for the doses the child needs next. */
export const getChildCentres = async (
  childId: string,
  params: ChildCentresQuery = {},
): Promise<ChildCentresResponse> => {
  const res = await axiosClient.get(`/children/${childId}/centres`, {
    params: {
      vaccineCode: csv(params.vaccineCode),
      radiusKm: params.radiusKm,
      limit: params.limit,
    },
  });
  return res.data.data as ChildCentresResponse;
};

/** PATCH /children/:id/doses/:doseId - administer, postpone, not-given or reopen. */


// ---------------------------------------------------------------------------
// Worklist, scope statistics, schedule
// ---------------------------------------------------------------------------

/** GET /vaccination/worklist - HELPER and HOSPITAL_STAFF only. */
export const getWorklist = async (params: WorklistQuery = {}): Promise<WorklistResponse> => {
  const res = await axiosClient.get('/vaccination/worklist', {
    params: {
      status: params.status,
      days: params.days,
      page: params.page,
      limit: params.limit,
      facilityId: params.facilityId,
      search: params.search,
    },
  });
  return res.data.data as WorklistResponse;
};


/** GET /vaccination/schedule - the active schedule, as newly registered children get it. */
export const getVaccinationSchedule = async (): Promise<ScheduleVaccine[]> => {
  const res = await axiosClient.get('/vaccination/schedule');
  return res.data.data as ScheduleVaccine[];
};

// ---------------------------------------------------------------------------
// In-app notifications (per user; polling, no socket events exist for these)
// ---------------------------------------------------------------------------

export const listNotifications = async (
  params: NotificationsQuery = {},
): Promise<NotificationListResponse> => {
  const res = await axiosClient.get('/vaccination/notifications', {
    params: { unread: params.unread, page: params.page, limit: params.limit },
  });
  return res.data.data as NotificationListResponse;
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const res = await axiosClient.get('/vaccination/notifications/unread-count');
  return (res.data.data as { unread: number }).unread;
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await axiosClient.patch(`/vaccination/notifications/${notificationId}/read`);
};

/** Returns how many notifications were marked. */
export const markAllNotificationsRead = async (): Promise<number> => {
  const res = await axiosClient.post('/vaccination/notifications/read-all');
  return (res.data.data as { marked: number }).marked;
};

// ---------------------------------------------------------------------------
// Vaccination centres
// ---------------------------------------------------------------------------

export const searchVaccinationCentres = async (
  params: CentreSearchQuery = {},
): Promise<CentreSearchResponse> => {
  const res = await axiosClient.get('/vaccination/centres', {
    params: {
      q: params.q,
      district: params.district,
      pinCode: params.pinCode,
      vaccineCode: csv(params.vaccineCode),
      lat: params.lat,
      lng: params.lng,
      radiusKm: params.radiusKm,
      page: params.page,
      limit: params.limit,
    },
  });
  return res.data.data as CentreSearchResponse;
};

export const getVaccinationCentre = async (facilityId: string): Promise<Centre> => {
  const res = await axiosClient.get(`/vaccination/centres/${facilityId}`);
  return res.data.data as Centre;
};

/**
 * PUT /vaccination/centres/:facilityId/vaccines - replaces the facility's full
 * list of offered vaccines. ADMIN (any facility) or HOSPITAL_STAFF (own facility).
 */
export const setCentreVaccines = async (
  facilityId: string,
  vaccines: CentreVaccineInput[],
): Promise<Centre> => {
  const res = await axiosClient.put(`/vaccination/centres/${facilityId}/vaccines`, { vaccines });
  return res.data.data as Centre;
};

/** PATCH /vaccination/centres/:facilityId/location - what centre search filters on. */
export const updateCentreLocation = async (
  facilityId: string,
  input: UpdateCentreLocationInput,
): Promise<Centre> => {
  const res = await axiosClient.patch(`/vaccination/centres/${facilityId}/location`, input);
  return res.data.data as Centre;
};

// ---------------------------------------------------------------------------
// Administrator (aggregates and schedule configuration only)
// ---------------------------------------------------------------------------

/** GET /vaccination/admin/stats - no child's name or contact details are returned. */
export const getAdminVaccinationStats = async (): Promise<AdminStats> => {
  const res = await axiosClient.get('/vaccination/admin/stats');
  return res.data.data as AdminStats;
};

/** GET /vaccination/admin/vaccines - includes inactive vaccines and entries. */
export const listVaccinesForAdmin = async (): Promise<AdminVaccine[]> => {
  const res = await axiosClient.get('/vaccination/admin/vaccines');
  return res.data.data as AdminVaccine[];
};

export const createVaccine = async (input: CreateVaccineInput): Promise<VaccineResult> => {
  const res = await axiosClient.post('/vaccination/admin/vaccines', input);
  return res.data.data as VaccineResult;
};

export const updateVaccine = async (
  vaccineId: string,
  input: UpdateVaccineInput,
): Promise<VaccineResult> => {
  const res = await axiosClient.patch(`/vaccination/admin/vaccines/${vaccineId}`, input);
  return res.data.data as VaccineResult;
};

export const createScheduleEntry = async (
  vaccineId: string,
  input: CreateScheduleEntryInput,
): Promise<ScheduleEntryResult> => {
  const res = await axiosClient.post(`/vaccination/admin/vaccines/${vaccineId}/entries`, input);
  return res.data.data as ScheduleEntryResult;
};

export const updateScheduleEntry = async (
  entryId: string,
  input: UpdateScheduleEntryInput,
): Promise<ScheduleEntryResult> => {
  const res = await axiosClient.patch(`/vaccination/admin/schedule-entries/${entryId}`, input);
  return res.data.data as ScheduleEntryResult;
};

/**
 * POST /vaccination/admin/reminders/run - runs one reminder cycle immediately.
 * `asOf` is rejected by the backend when NODE_ENV=production.
 */
export const runReminderCycle = async (asOf?: string): Promise<ReminderCycleStats> => {
  const res = await axiosClient.post('/vaccination/admin/reminders/run', asOf ? { asOf } : {});
  return res.data.data as ReminderCycleStats;
};

/* ---------- Phase 3: child registration and the children list ---------- */

/** One page of children. The endpoint supports only `page` and `limit`. */
export const fetchChildren = async (page = 1, limit = 20): Promise<ChildrenPage> => {
  const res = await axiosClient.get('/children', { params: { page, limit } });
  return res.data.data;
};

/** Registers a child; the backend generates the whole dose schedule from this. */


/** The active schedule, used to pick doses the child has already received. */
export const fetchVaccineSchedule = async (): Promise<VaccineScheduleView[]> => {
  const res = await axiosClient.get('/vaccination/schedule');
  return res.data.data;
};

/**
 * Active facilities, offered only as an optional choice when a user is linked to
 * more than one facility. The API rejects facilities the user is not linked to.
 */
export const fetchFacilityOptions = async (): Promise<FacilityOption[]> => {
  const res = await axiosClient.get('/facilities');
  return res.data.data;
};

export type ChildRegistrationFailure =
  | { kind: 'DUPLICATES'; message: string; matches: DuplicateChildMatch[] }
  | { kind: 'INVALID'; message: string; errors: string[] }
  | { kind: 'OTHER'; message: string };

interface ChildRegistrationErrorBody {
  code?: string;
  message?: string;
  errors?: unknown;
  data?: { matches?: unknown };
  error?: { message?: string; details?: { message?: string }[] };
}

/**
 * Registration failures do NOT use the project's normal error envelope:
 *   409 -> { code: 'POSSIBLE_DUPLICATES', message, data: { matches } }
 *   400 -> { code: 'INVALID_CHILD_DATA', message, errors: string[] }
 * Everything else (422 validation, 403, 404, 500) uses { error: { message, details } }.
 * `getApiErrorMessage` only understands the last shape, so registration gets this.
 */
export const describeChildRegistrationError = (err: unknown): ChildRegistrationFailure => {
  const body = (err as { response?: { data?: ChildRegistrationErrorBody } })?.response?.data;

  if (body?.code === 'POSSIBLE_DUPLICATES') {
    const matches = Array.isArray(body.data?.matches)
      ? (body.data?.matches as DuplicateChildMatch[])
      : [];
    return {
      kind: 'DUPLICATES',
      message: body.message ?? 'A child with the same details may already be registered.',
      matches,
    };
  }

  if (body?.code === 'INVALID_CHILD_DATA') {
    const errors = Array.isArray(body.errors)
      ? body.errors.map((e) => String(e))
      : ['The details do not match a valid vaccination schedule.'];
    return {
      kind: 'INVALID',
      message: body.message ?? 'Please correct the following problems',
      errors,
    };
  }

  const message =
    body?.error?.details?.[0]?.message ||
    body?.error?.message ||
    'Could not register the child. Please try again.';
  return { kind: 'OTHER', message };
};

/** Full child profile (contact, address, consent) — GET /children/:id. */
export const fetchChildProfile = async (childId: string): Promise<ChildProfile> => {
  const res = await axiosClient.get(`/children/${childId}`);
  return res.data.data;
};

/** Child page payload in one call — GET /children/:id/dashboard. */
export const fetchChildDashboard = async (childId: string): Promise<ChildDashboard> => {
  const res = await axiosClient.get(`/children/${childId}/dashboard`);
  return res.data.data;
};

/** Record, postpone, mark not given, or reopen one dose. */
export async function recordDose(
  childId: string,
  doseId: string,
  input: RecordDoseInput
): Promise<ChildDashboardDose> {
  const { data } = await axiosClient.patch<{ success: boolean; data: ChildDashboardDose }>(
    `/children/${childId}/doses/${doseId}`,
    input
  );
  return data.data;
}

// ---------- Statistics (Phase 9) ----------
// AGGREGATES ONLY: no child names, contacts or individual records come back here.

export interface VaccinationScopeStats {
  asOf: string;
  children: number;
  childrenWithOverdue: number;
  overdueDoses: number;
  dueToday: number;
  dueNext7Days: number;
  administeredLast30Days: number;
}

export interface VaccinationCoverageRow {
  vaccineCode: string;
  administered: number;
  notGiven: number;
  overdue: number;
  coveragePercent: number;
}

export interface VaccinationAdminStats {
  asOf: string;
  children: {
    total: number;
    registeredLast30Days: number;
    withoutFacility: number;
    byDistrict: { district: string; count: number }[];
    topFacilities: { facilityId: string; name: string; count: number }[];
  };
  doses: {
    total: number;
    administered: number;
    pending: number;
    postponed: number;
    notGiven: number;
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
  };
  byVaccine: VaccinationCoverageRow[];
  reminders: {
    last7Days: Record<string, number>;
    deliveriesLast7Days: { channel: string; status: string; count: number }[];
  };
  centres: { facilitiesOfferingVaccines: number };
}

/** Helper / hospital-staff numbers, already limited to the children they can access. */
export const getMyVaccinationStats = async (): Promise<VaccinationScopeStats> => {
  const res = await axiosClient.get('/vaccination/stats');
  return res.data.data;
};

/** Programme-wide aggregate figures. Admin only; the server returns 403 for anyone else. */
export const getVaccinationAdminStats = async (): Promise<VaccinationAdminStats> => {
  const res = await axiosClient.get('/vaccination/admin/stats');
  return res.data.data;
};

// ---------- Admin schedule management (Phase 10) ----------
// Editing the schedule changes what NEW children get. Registered children keep
// their existing doses and dates; the server returns that note with every write.

export type VaccinationAgeUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export type VaccinationApplicability = 'ALWAYS' | 'JE_ENDEMIC_DISTRICT' | 'FEMALE_ONLY';

export interface AdminScheduleEntry {
  id: string;
  vaccineId: string;
  doseNumber: number;
  doseLabel: string;
  ageValue: number;
  ageUnit: VaccinationAgeUnit;
  ageLabel: string;
  applicability: VaccinationApplicability;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
}

export interface AdminVaccine {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  scheduleEntries: AdminScheduleEntry[];
}

export interface NewScheduleEntryInput {
  doseNumber: number;
  doseLabel: string;
  ageValue: number;
  ageUnit: VaccinationAgeUnit;
  ageLabel: string;
  applicability?: VaccinationApplicability;
  sortOrder?: number;
  isActive?: boolean;
  notes?: string | null;
}

export interface ReminderCycleStats {
  created: number;
  revived: number;
  cancelled: number;
  recovered: number;
  groupsProcessed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

export const getAdminVaccines = async (): Promise<AdminVaccine[]> => {
  const res = await axiosClient.get('/vaccination/admin/vaccines');
  return res.data.data;
};

export const createAdminVaccine = async (input: {
  code: string;
  name: string;
  description?: string | null;
}): Promise<{ vaccine: AdminVaccine; note?: string }> => {
  const res = await axiosClient.post('/vaccination/admin/vaccines', {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description ? input.description.trim() : undefined,
  });
  return res.data.data;
};

export const updateAdminVaccine = async (
  id: string,
  input: { name?: string; description?: string | null; isActive?: boolean },
): Promise<{ vaccine: AdminVaccine; note?: string }> => {
  const res = await axiosClient.patch(`/vaccination/admin/vaccines/${id}`, input);
  return res.data.data;
};

export const createAdminScheduleEntry = async (
  vaccineId: string,
  input: NewScheduleEntryInput,
): Promise<{ entry: AdminScheduleEntry; note?: string }> => {
  const res = await axiosClient.post(`/vaccination/admin/vaccines/${vaccineId}/entries`, input);
  return res.data.data;
};

/** The dose number and parent vaccine cannot change; create a new entry instead. */
export const updateAdminScheduleEntry = async (
  entryId: string,
  input: Partial<Omit<NewScheduleEntryInput, 'doseNumber'>>,
): Promise<{ entry: AdminScheduleEntry; note?: string }> => {
  const res = await axiosClient.patch(`/vaccination/admin/schedule-entries/${entryId}`, input);
  return res.data.data;
};

/**
 * Run the reminder engine immediately. `asOf` is an ISO date-time and the server
 * rejects it outside development, so only send it when it was entered.
 */
export const runAdminReminders = async (asOf?: string): Promise<ReminderCycleStats> => {
  const res = await axiosClient.post(
    '/vaccination/admin/reminders/run',
    asOf ? { asOf } : {},
  );
  return res.data.data;
};
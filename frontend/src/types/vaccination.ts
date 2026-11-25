/**
 * API types for the vaccination tracker.
 *
 * These mirror, field for field, the JSON produced by:
 *   src/modules/vaccination/child.service.ts        (profile, list, registration)
 *   src/modules/vaccination/dashboard.service.ts    (dashboard, history)
 *   src/modules/vaccination/worklist.service.ts     (worklist)
 *   src/modules/vaccination/statistics.service.ts   (scope + admin statistics)
 *   src/modules/vaccination/notification.service.ts (notifications)
 *   src/modules/vaccination/centre.service.ts       (centres)
 *   src/modules/vaccination/schedule.admin.service.ts (vaccines + schedule)
 *   src/modules/vaccination/reminder.service.ts     (reminders, cycle stats)
 *
 * Nothing here is calculated in the browser: statuses, counts and dates all
 * come from the backend. Do not re-implement schedule or status logic here.
 */

// ---------- enums (string unions, not TS enums) ----------

export type ChildGender = 'MALE' | 'FEMALE' | 'OTHER';
export type PreferredLanguage = 'EN' | 'HI';

export type AgeUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
export type ApplicabilityRule = 'ALWAYS' | 'JE_ENDEMIC_DISTRICT' | 'FEMALE_ONLY';

/** What is stored on the dose row. */
export type DoseRecordStatus = 'PENDING' | 'ADMINISTERED' | 'POSTPONED' | 'NOT_GIVEN';

/** What the UI shows: the stored status, or UPCOMING / DUE / OVERDUE derived from the due date. */
export type EffectiveDoseStatus =
  | 'UPCOMING'
  | 'DUE'
  | 'OVERDUE'
  | 'ADMINISTERED'
  | 'POSTPONED'
  | 'NOT_GIVEN';

/** The `action` value accepted by PATCH /children/:id/doses/:doseId. */

export type WorklistStatus = 'OVERDUE' | 'DUE' | 'UPCOMING' | 'ALL';

export type ReminderKind = 'TWO_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'ON_DUE_DATE' | 'ONE_DAY_AFTER';
export type ReminderStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
export type DeliveryChannel = 'SMS' | 'IN_APP' | 'EMAIL';
export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

/** Roles that may use the vaccination tracker UI. ADMIN sees aggregates only. */
export type VaccinationRole = 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN';

// ---------- small shared shapes ----------

export interface FacilitySummary {
  id: string;
  name: string;
  type: string;
}

export interface FacilityOption {
  id: string;
  name: string;
  type: string;
  address: string;
  district: string | null;
  pinCode: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** `changedBy` / `recordedBy`: the helper's full name when there is one, else the email. */
export interface PersonRef {
  id: string;
  role: string;
  name: string;
}

// ---------- children ----------

/** A dose as it appears inside a child's full profile (GET /children/:id). */
export interface ChildProfileDose {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  ageLabel: string;
  originalDueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  recordedStatus: DoseRecordStatus;
  status: EffectiveDoseStatus;
  administeredOn: string | null;
  isHistorical: boolean;
  notes: string | null;
}

export interface ChildProfileSummary {
  total: number;
  administered: number;
  overdue: number;
  due: number;
  upcoming: number;
  postponed: number;
  notGiven: number;
}

export interface ChildProfile {
  id: string;
  recordNumber: string; // e.g. SSV-000123
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: ChildGender;
  birthWeightGrams: number | null;
  motherName: string;
  fatherName: string;
  guardianName: string | null;
  primaryMobile: string;
  alternateMobile: string | null;
  email: string | null;
  addressLine: string;
  village: string;
  district: string;
  state: string;
  pinCode: string;
  latitude: number | null;
  longitude: number | null;
  jeEndemicArea: boolean;
  preferredLanguage: PreferredLanguage;
  smsConsent: boolean;
  smsConsentAt: string | null;
  assignedFacility: FacilitySummary | null;
  createdAt: string;
  doses: ChildProfileDose[];
  summary: ChildProfileSummary;
}

/**
 * One row of GET /children.
 *
 * NOTE: the backend list endpoint returns only `overdueCount` and
 * `dueTodayCount`; it does not return a next-due date. Search on this list is
 * done in the browser (the API supports page/limit only).
 */
export interface ChildListItem {
  id: string;
  recordNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: ChildGender;
  village: string;
  district: string;
  assignedFacility: { id: string; name: string } | null;
  createdAt: string;
  overdueCount: number;
  dueTodayCount: number;
}

export interface ChildListResponse {
  items: ChildListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ChildListQuery {
  page?: number;
  limit?: number;
}

/** A historical dose the child already received before registration. */
export interface ChildHistoryInput {
  vaccineCode: string;
  doseNumber: number;
  administeredOn: string; // YYYY-MM-DD
}

/** Body for POST /children. */
export interface RegisterChildInput {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: ChildGender;
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
  preferredLanguage?: PreferredLanguage;
  smsConsent?: boolean;
  facilityId?: string | null;
  /** Send true only after the user has seen the duplicate warning and confirmed. */
  confirmDuplicate?: boolean;
  history?: ChildHistoryInput[];
}

/** Body for PATCH /children/:id (contact and address fields only). */
export interface UpdateChildInput {
  guardianName?: string | null;
  primaryMobile?: string;
  alternateMobile?: string | null;
  email?: string | null;
  addressLine?: string;
  village?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferredLanguage?: PreferredLanguage;
  smsConsent?: boolean;
}

/** One possible duplicate from a 409 POSSIBLE_DUPLICATES response. */
export interface ChildDuplicateMatch {
  /** null when the requester is not allowed to open that record. */
  id: string | null;
  recordNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  village: string;
  district: string;
  /** Which fields matched, e.g. ["DATE_OF_BIRTH", "MOTHER_NAME"]. */
  matchedOn: string[];
  canView: boolean;
}

// ---------- doses ----------

/** The dose shape used by the dashboard, history and worklist views. */
export interface DoseView {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  ageLabel: string;
  originalDueDate: string;
  dueDate: string;
  recordedStatus: DoseRecordStatus;
  status: EffectiveDoseStatus;
  daysOverdue: number;
  daysUntilDue: number;
  administeredOn: string | null;
  administeredFacility: { id: string; name: string } | null;
  recordedBy: PersonRef | null;
  isHistorical: boolean;
  notes: string | null;
}

/** Body for PATCH /children/:id/doses/:doseId. */
export interface RecordDoseInput {
  action: DoseAction;
  /** ADMINISTERED: defaults to today on the server. */
  administeredOn?: string;
  /** POSTPONED: the new due date. */
  newDueDate?: string;
  /** Required by the backend for POSTPONED and NOT_GIVEN, and for corrections. */
  note?: string;
  /** ADMINISTERED only; stored inside the dose note by the backend. */
  batchNumber?: string;
  /** ADMINISTERED only; must be a facility the user is linked to. */
  facilityId?: string;
}

// ---------- child dashboard ----------

export interface ChildDashboardChild {
  id: string;
  recordNumber: string;
  fullName: string;
  dateOfBirth: string;
  /** Age in words from the backend, e.g. "7 months" or "3 years 2 months". */
  age: string;
  gender: ChildGender;
  village: string;
  district: string;
  jeEndemicArea: boolean;
  preferredLanguage: PreferredLanguage;
  smsConsent: boolean;
  assignedFacility: FacilitySummary | null;
}

export interface ChildDashboardSummary {
  total: number;
  administered: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  notGiven: number;
  completionPercent: number;
}

export interface NextVisit {
  date: string;
  /** Every dose due on that date, so one session can cover them all. */
  doses: DoseView[];
}

export interface DoseActivity {
  id: string;
  at: string;
  vaccineName: string;
  doseLabel: string;
  fromStatus: DoseRecordStatus | null;
  toStatus: DoseRecordStatus;
  fromDueDate: string | null;
  toDueDate: string | null;
  note: string | null;
  changedBy: PersonRef | null;
}

export interface ChildDashboard {
  child: ChildDashboardChild;
  asOf: string;
  summary: ChildDashboardSummary;
  overdue: DoseView[];
  dueToday: DoseView[];
  nextVisit: NextVisit | null;
  upcoming: DoseView[];
  completed: DoseView[];
  notGiven: DoseView[];
  recentActivity: DoseActivity[];
}

// ---------- history (audit trail) ----------

export interface ChildHistoryItem {
  id: string;
  at: string;
  doseId: string;
  vaccineName: string;
  doseLabel: string;
  fromStatus: DoseRecordStatus | null;
  toStatus: DoseRecordStatus;
  fromDueDate: string | null;
  toDueDate: string | null;
  note: string | null;
  changedBy: PersonRef | null;
}

export interface ChildHistoryResponse {
  total: number;
  page: number;
  limit: number;
  items: ChildHistoryItem[];
}

export interface ChildHistoryQuery {
  page?: number;
  limit?: number;
}

// ---------- reminders ----------

export interface ReminderDelivery {
  channel: DeliveryChannel;
  status: DeliveryStatus;
  provider: string | null;
  /** Masked on the backend, e.g. ******1234. */
  recipient: string | null;
  attemptNumber: number;
  attemptedAt: string;
  error: string | null;
}

export interface ChildReminder {
  id: string;
  kind: ReminderKind;
  status: ReminderStatus;
  skipReason: string | null;
  vaccineName: string;
  doseLabel: string;
  dueDate: string;
  scheduledFor: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  processedAt: string | null;
  deliveries: ReminderDelivery[];
}

// ---------- worklist ----------

export interface WorklistItem {
  doseId: string;
  childId: string;
  recordNumber: string;
  childName: string;
  village: string;
  district: string;
  parentMobile: string;
  vaccineName: string;
  doseLabel: string;
  dueDate: string;
  status: EffectiveDoseStatus;
  daysOverdue: number;
  daysUntilDue: number;
}

export interface WorklistQuery {
  status?: WorklistStatus;
  /** How far ahead UPCOMING looks, 1-90 (backend default 7). */
  days?: number;
  page?: number;
  limit?: number;
  facilityId?: string;
  /** Child name search, performed by the backend (`contains`, case-insensitive). */
  search?: string;
}

export interface WorklistResponse {
  asOf: string;
  summary: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    upcomingDays: number;
  };
  total: number;
  page: number;
  limit: number;
  items: WorklistItem[];
}

// ---------- statistics ----------

/** GET /vaccination/stats - the caller's own scope (helper or hospital staff). */
export interface ScopeStats {
  asOf: string;
  children: number;
  childrenWithOverdue: number;
  overdueDoses: number;
  dueToday: number;
  dueNext7Days: number;
  administeredLast30Days: number;
}

export interface VaccineCoverageRow {
  vaccineCode: string;
  administered: number;
  notGiven: number;
  overdue: number;
  coveragePercent: number;
}

export interface DistrictCount {
  district: string;
  count: number;
}

export interface FacilityCount {
  facilityId: string | null;
  name: string;
  count: number;
}

export interface DeliveryCount {
  channel: DeliveryChannel;
  status: DeliveryStatus;
  count: number;
}

/** GET /vaccination/admin/stats - aggregates only, never a child's record. */
export interface AdminStats {
  asOf: string;
  children: {
    total: number;
    registeredLast30Days: number;
    withoutFacility: number;
    byDistrict: DistrictCount[];
    topFacilities: FacilityCount[];
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
  byVaccine: VaccineCoverageRow[];
  reminders: {
    last7Days: Record<string, number>;
    deliveriesLast7Days: DeliveryCount[];
  };
  centres: {
    facilitiesOfferingVaccines: number;
  };
}

// ---------- notifications ----------

export interface VaccinationNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  doseId: string;
  child: {
    id: string;
    fullName: string;
    recordNumber: string;
  };
}

export interface NotificationListResponse {
  total: number;
  unread: number;
  page: number;
  limit: number;
  items: VaccinationNotification[];
}

export interface NotificationsQuery {
  unread?: boolean;
  page?: number;
  limit?: number;
}

// ---------- vaccination centres ----------

export interface CentreVaccine {
  code: string;
  name: string;
  sessionInfo: string | null;
}

export interface Centre {
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

/** A centre as returned by search: distance and which requested vaccines it has. */
export interface RankedCentre extends Centre {
  distanceKm: number | null;
  matchedVaccineCodes: string[];
}

export interface CentreSearchQuery {
  q?: string;
  district?: string;
  pinCode?: string;
  /** One code or several; joined into the CSV the API expects. */
  vaccineCode?: string | string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
}

export interface CentreSearchResponse {
  total: number;
  page: number;
  limit: number;
  items: RankedCentre[];
}

/** GET /children/:id/centres - centres for the child's next doses. */
export interface ChildCentresResponse {
  vaccineCodes: string[];
  basedOn: 'LOCATION' | 'DISTRICT';
  items: RankedCentre[];
}

export interface ChildCentresQuery {
  vaccineCode?: string | string[];
  radiusKm?: number;
  limit?: number;
}

export interface CentreVaccineInput {
  vaccineCode: string;
  sessionInfo?: string | null;
}

export interface UpdateCentreLocationInput {
  district?: string;
  pinCode?: string;
}

// ---------- schedule and vaccines (admin) ----------

export interface ScheduleEntry {
  id: string;
  vaccineId: string;
  doseNumber: number;
  doseLabel: string;
  ageValue: number;
  ageUnit: AgeUnit;
  ageLabel: string;
  applicability: ApplicabilityRule;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
}

/** A vaccine in the read-only schedule (GET /vaccination/schedule, active only). */
export interface ScheduleVaccine {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scheduleEntries: ScheduleEntry[];
}

/** A vaccine in the admin list (includes inactive vaccines and entries). */
export interface AdminVaccine {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  scheduleEntries: ScheduleEntry[];
}

export interface CreateVaccineInput {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateVaccineInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateScheduleEntryInput {
  doseNumber: number;
  doseLabel: string;
  ageValue: number;
  ageUnit: AgeUnit;
  ageLabel: string;
  applicability?: ApplicabilityRule;
  sortOrder?: number;
  isActive?: boolean;
  notes?: string | null;
}

/** doseNumber cannot change: the backend rejects it with 400. */
export type UpdateScheduleEntryInput = Partial<Omit<CreateScheduleEntryInput, 'doseNumber'>>;

export interface VaccineResult {
  vaccine: AdminVaccine;
  /** The backend explains that schedule changes apply to newly registered children only. */
  note: string;
}

export interface ScheduleEntryResult {
  entry: ScheduleEntry;
  note: string;
}

// ---------- reminder engine (admin) ----------

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

/* ---------- Phase 3: child registration and the children list ---------- */

/**
 * Phase 3 compatibility names.
 *
 * These types already exist above in their canonical Phase 2 forms. Re-export
 * them as aliases rather than redeclaring duplicate interfaces/type aliases.
 */

export type ChildSummary = ChildListItem;
export type ChildrenPage = ChildListResponse;

export type DuplicateReason =
  | 'SAME_MOBILE'
  | 'SAME_MOTHER'
  | 'SAME_FATHER'
  | 'SAME_CHILD_NAME';

export interface DuplicateChildMatch {
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

export type HistoricalDoseInput = ChildHistoryInput;
export type ChildDoseView = ChildProfileDose;

/** The Phase 2 ChildProfile already contains the complete Phase 3 profile. */
export type VaccineScheduleEntryView = ScheduleEntry;
export type VaccineScheduleView = ScheduleVaccine;

// ---------- Phase 4: child dashboard (GET /children/:id/dashboard) ----------

export interface ChildDashboardDose {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  ageLabel: string;
  originalDueDate: string;
  dueDate: string;
  recordedStatus: DoseRecordStatus;
  status: EffectiveDoseStatus;
  daysOverdue: number;
  daysUntilDue: number;
  administeredOn: string | null;
  administeredFacility: { id: string; name: string } | null;
  recordedBy: { id: string; role: string; name: string } | null;
  isHistorical: boolean;
  notes: string | null;
}

export interface ChildDashboardChild {
  id: string;
  recordNumber: string;
  fullName: string;
  dateOfBirth: string;
  age: string;
  gender: ChildGender;
  village: string;
  district: string;
  jeEndemicArea: boolean;
  preferredLanguage: PreferredLanguage;
  smsConsent: boolean;
  assignedFacility: { id: string; name: string; type: string } | null;
}

export interface ChildDashboardSummary {
  total: number;
  administered: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  notGiven: number;
  completionPercent: number;
}

export interface ChildNextVisit {
  date: string;
  doses: ChildDashboardDose[];
}

export interface ChildActivityEntry {
  id: string;
  at: string;
  vaccineName: string;
  doseLabel: string;
  fromStatus: DoseRecordStatus | null;
  toStatus: DoseRecordStatus;
  fromDueDate: string | null;
  toDueDate: string | null;
  note: string | null;
  changedBy: { id: string; role: string; name: string } | null;
}

export interface ChildDashboard {
  child: ChildDashboardChild;
  asOf: string;
  summary: ChildDashboardSummary;
  overdue: ChildDashboardDose[];
  dueToday: ChildDashboardDose[];
  nextVisit: ChildNextVisit | null;
  upcoming: ChildDashboardDose[];
  completed: ChildDashboardDose[];
  notGiven: ChildDashboardDose[];
  recentActivity: ChildActivityEntry[];
}

// ---------- Dose actions (Phase 5) ----------

/** The four actions accepted by PATCH /children/:id/doses/:doseId. */
export type DoseAction = 'ADMINISTERED' | 'POSTPONED' | 'NOT_GIVEN' | 'PENDING';

export interface RecordDoseInput {
  action: DoseAction;
  /** YYYY-MM-DD. Only for ADMINISTERED; the server defaults to today. */
  administeredOn?: string;
  /** YYYY-MM-DD. Only for POSTPONED; must be after today. */
  newDueDate?: string;
  /** Required for POSTPONED, NOT_GIVEN and PENDING. Max 300 characters. */
  note?: string;
  /** Optional batch/lot number for ADMINISTERED. Max 30 characters. */
  batchNumber?: string;
}
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { cleanText } from './child.utils';
import { validateAge, validateDoseOrdering } from './schedule.admin.rules';
import type { AgeUnit } from './vaccination.dates';
import type { ApplicabilityRule } from './vaccination.schedule';

const entrySelect = {
  id: true, vaccineId: true, doseNumber: true, doseLabel: true, ageValue: true, ageUnit: true,
  ageLabel: true, applicability: true, sortOrder: true, isActive: true, notes: true,
} satisfies Prisma.VaccineScheduleEntrySelect;

const vaccineInclude = {
  scheduleEntries: { select: entrySelect, orderBy: [{ sortOrder: 'asc' as const }, { doseNumber: 'asc' as const }] },
} satisfies Prisma.VaccineInclude;

const NEW_CHILDREN_ONLY =
  'Schedule changes apply to children registered from now on. Children already registered keep the doses and dates they were given.';

// ---------- reading ----------

/** Admin view: everything, including inactive vaccines and entries. */
export const listVaccinesForAdmin = async () => {
  const vaccines = await prisma.vaccine.findMany({ include: vaccineInclude, orderBy: { code: 'asc' } });
  return vaccines;
};

/** Any signed-in user: the schedule as new children would get it (active parts only). */
export const getActiveSchedule = async () => {
  const vaccines = await prisma.vaccine.findMany({
    where: { isActive: true },
    select: {
      id: true, code: true, name: true, description: true,
      scheduleEntries: { where: { isActive: true }, select: entrySelect, orderBy: [{ sortOrder: 'asc' }, { doseNumber: 'asc' }] },
    },
    orderBy: { code: 'asc' },
  });
  return vaccines;
};

// ---------- vaccines ----------

export const createVaccine = async (body: { code: string; name: string; description?: string | null }) => {
  const code = body.code.trim().toUpperCase();
  const exists = await prisma.vaccine.findUnique({ where: { code }, select: { id: true } });
  if (exists) throw new AppError(`A vaccine with code ${code} already exists`, 409);

  const vaccine = await prisma.vaccine.create({
    data: { code, name: body.name.trim(), description: cleanText(body.description) },
    include: vaccineInclude,
  });
  return { vaccine, note: 'Add its doses with POST /vaccination/admin/vaccines/:id/entries' };
};

export const updateVaccine = async (id: string, body: { name?: string; description?: string | null; isActive?: boolean }) => {
  const existing = await prisma.vaccine.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Vaccine not found', 404);

  const data: Prisma.VaccineUpdateInput = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name);
    if (!name) throw new AppError('name cannot be empty', 400);
    data.name = name;
  }
  if (body.description !== undefined) data.description = cleanText(body.description);
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (Object.keys(data).length === 0) throw new AppError('Nothing to update', 400);

  const vaccine = await prisma.vaccine.update({ where: { id }, data, include: vaccineInclude });
  return { vaccine, note: NEW_CHILDREN_ONLY };
};

// ---------- schedule entries ----------

export interface EntryBody {
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

export const createEntry = async (vaccineId: string, body: EntryBody) => {
  const vaccine = await prisma.vaccine.findUnique({
    where: { id: vaccineId },
    select: { id: true, scheduleEntries: { select: { doseNumber: true, ageValue: true, ageUnit: true, isActive: true } } },
  });
  if (!vaccine) throw new AppError('Vaccine not found', 404);

  if (vaccine.scheduleEntries.some((e) => e.doseNumber === body.doseNumber)) {
    throw new AppError(`Dose ${body.doseNumber} of this vaccine already exists. Edit it instead.`, 409);
  }
  const ageError = validateAge(body.ageValue, body.ageUnit);
  if (ageError) throw new AppError(ageError, 400);

  const isActive = body.isActive ?? true;
  const orderError = validateDoseOrdering(vaccine.scheduleEntries, {
    doseNumber: body.doseNumber, ageValue: body.ageValue, ageUnit: body.ageUnit, isActive,
  });
  if (orderError) throw new AppError(orderError, 400);

  let sortOrder = body.sortOrder;
  if (sortOrder === undefined) {
    const max = await prisma.vaccineScheduleEntry.aggregate({ _max: { sortOrder: true } });
    sortOrder = (max._max.sortOrder ?? 0) + 1;
  }

  const entry = await prisma.vaccineScheduleEntry.create({
    data: {
      vaccineId,
      doseNumber: body.doseNumber,
      doseLabel: body.doseLabel.trim(),
      ageValue: body.ageValue,
      ageUnit: body.ageUnit,
      ageLabel: body.ageLabel.trim(),
      applicability: body.applicability ?? 'ALWAYS',
      sortOrder,
      isActive,
      notes: cleanText(body.notes),
    },
    select: entrySelect,
  });
  return { entry, note: NEW_CHILDREN_ONLY };
};

/** The vaccine and dose number of an entry cannot change: create a new entry instead. */
export const updateEntry = async (id: string, body: Partial<Omit<EntryBody, 'doseNumber'>>) => {
  const current = await prisma.vaccineScheduleEntry.findUnique({ where: { id }, select: entrySelect });
  if (!current) throw new AppError('Schedule entry not found', 404);

  const ageValue = body.ageValue ?? current.ageValue;
  const ageUnit = body.ageUnit ?? current.ageUnit;
  const isActive = body.isActive ?? current.isActive;

  if (body.ageValue !== undefined || body.ageUnit !== undefined) {
    const ageError = validateAge(ageValue, ageUnit);
    if (ageError) throw new AppError(ageError, 400);
  }

  const siblings = await prisma.vaccineScheduleEntry.findMany({
    where: { vaccineId: current.vaccineId },
    select: { doseNumber: true, ageValue: true, ageUnit: true, isActive: true },
  });
  const orderError = validateDoseOrdering(siblings, { doseNumber: current.doseNumber, ageValue, ageUnit, isActive });
  if (orderError) throw new AppError(orderError, 400);

  const data: Prisma.VaccineScheduleEntryUpdateInput = {};
  if (body.doseLabel !== undefined) {
    const v = cleanText(body.doseLabel);
    if (!v) throw new AppError('doseLabel cannot be empty', 400);
    data.doseLabel = v;
  }
  if (body.ageLabel !== undefined) {
    const v = cleanText(body.ageLabel);
    if (!v) throw new AppError('ageLabel cannot be empty', 400);
    data.ageLabel = v;
  }
  if (body.ageValue !== undefined) data.ageValue = body.ageValue;
  if (body.ageUnit !== undefined) data.ageUnit = body.ageUnit;
  if (body.applicability !== undefined) data.applicability = body.applicability;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.notes !== undefined) data.notes = cleanText(body.notes);
  if (Object.keys(data).length === 0) throw new AppError('Nothing to update', 400);

  const entry = await prisma.vaccineScheduleEntry.update({ where: { id }, data, select: entrySelect });
  return { entry, note: NEW_CHILDREN_ONLY };
};

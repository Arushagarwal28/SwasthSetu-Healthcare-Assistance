import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter, getLinkedFacilityIds } from './child.access';
import type { Actor } from './child.access';
import { todayInIst } from './vaccination.dates';
import { planDoseChange } from './dose.rules';
import type { DoseAction } from './dose.rules';
import { cleanText, toYmd, ymdToDate } from './child.utils';
import { doseInclude, toDoseView } from './dose.view';

export interface RecordDoseBody {
  action: DoseAction;
  administeredOn?: string | null;
  newDueDate?: string | null;
  note?: string | null;
  batchNumber?: string | null;
  facilityId?: string | null;
}

/**
 * Where was the dose given? Only a facility the user is linked to can be named.
 * If none is named: the child's own facility (when the user is linked to it),
 * otherwise the user's only facility, otherwise unknown (null).
 */
const resolveAdministeredFacility = async (
  actor: Actor,
  requested: string | null,
  childFacilityId: string | null
): Promise<string | null> => {
  const linked = await getLinkedFacilityIds(actor);

  if (requested) {
    if (!linked.includes(requested)) {
      throw new AppError('You can only record a dose at a facility you are linked to', 403);
    }
    const facility = await prisma.facility.findUnique({ where: { id: requested }, select: { id: true } });
    if (!facility) throw new AppError('Facility not found', 404);
    return requested;
  }
  if (childFacilityId && linked.includes(childFacilityId)) return childFacilityId;
  if (linked.length === 1) return linked[0] ?? null;
  return null;
};

export const recordDose = async (actor: Actor, childId: string, doseId: string, body: RecordDoseBody) => {
  // 1. The child must exist and be visible to this user (otherwise 404)
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    select: { id: true, dateOfBirth: true, assignedFacilityId: true },
  });
  if (!child) throw new AppError('Child not found', 404);

  // 2. The dose must belong to that child
  const dose = await prisma.childDose.findFirst({ where: { id: doseId, childId: child.id } });
  if (!dose) throw new AppError('Dose not found', 404);

  const today = todayInIst();

  // 3. Apply the rules
  const decision = planDoseChange(
    { recordedStatus: dose.recordedStatus, dueDate: toYmd(dose.dueDate) },
    toYmd(child.dateOfBirth),
    {
      action: body.action,
      administeredOn: body.administeredOn ?? null,
      newDueDate: body.newDueDate ?? null,
      note: body.note ?? null,
      batchNumber: body.batchNumber ?? null,
    },
    today
  );
  if (!decision.ok) throw new AppError(decision.error, decision.status);
  const plan = decision.plan;

  const facilityId =
    plan.toStatus === 'ADMINISTERED'
      ? await resolveAdministeredFacility(actor, cleanText(body.facilityId), child.assignedFacilityId)
      : null;

  const isReopen = plan.toStatus === 'PENDING';

  // 4. Update the dose and write the audit row together. The update only
  //    succeeds if nobody else changed the dose since we read it.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.childDose.updateMany({
      where: { id: dose.id, updatedAt: dose.updatedAt },
      data: {
        recordedStatus: plan.toStatus,
        dueDate: ymdToDate(plan.dueDate),
        administeredOn: plan.administeredOn ? ymdToDate(plan.administeredOn) : null,
        administeredFacilityId: facilityId,
        recordedById: isReopen ? null : actor.userId,
        isHistorical: false,
        notes: isReopen ? null : plan.note,
      },
    });
    if (updated.count !== 1) {
      throw new AppError('This dose was changed by someone else just now. Please reload and try again.', 409);
    }

    await tx.childDoseEvent.create({
      data: {
        doseId: dose.id,
        fromStatus: dose.recordedStatus,
        toStatus: plan.toStatus,
        fromDueDate: dose.dueDate,
        toDueDate: ymdToDate(plan.dueDate),
        changedById: actor.userId,
        note: plan.note,
      },
    });
  });

  const fresh = await prisma.childDose.findUniqueOrThrow({ where: { id: dose.id }, include: doseInclude });
  return toDoseView(fresh, today);
};

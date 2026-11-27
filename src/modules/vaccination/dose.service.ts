import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter, getActiveGrantForChild, getLinkedFacilityIds } from './child.access';
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
  /** The facility of this encounter. Only a linked, active facility is accepted. */
  facilityId?: string | null;
}

/**
 * Where did THIS encounter/action happen?
 *
 * There is no child-level facility fallback any more: a child does not belong to
 * a facility. The event is attributed to:
 *  - the facility that issued the live temporary grant (a mismatch is refused),
 *  - otherwise a facility the user explicitly named (must be linked + active),
 *  - otherwise the user's only linked facility,
 *  - otherwise null (unknown), never a guess.
 *
 * For an ADMINISTERED action the same value is the actual administering
 * facility. For POSTPONED / NOT_GIVEN / corrections it is only the place where
 * the decision was recorded; it never implies administration.
 */
const resolveEventFacility = async (
  actor: Actor,
  requested: string | null,
  grantFacilityId: string | null
): Promise<string | null> => {
  if (grantFacilityId) {
    if (requested && requested !== grantFacilityId) {
      throw new AppError(
        'This temporary access was verified at another facility. Verify the child again at this facility to record a dose here.',
        403
      );
    }
    const facility = await prisma.facility.findUnique({
      where: { id: grantFacilityId, isActive: true },
      select: { id: true },
    });
    return facility ? grantFacilityId : null;
  }

  const linked = await getLinkedFacilityIds(actor);

  if (requested) {
    if (!linked.includes(requested)) {
      throw new AppError('You can only record a vaccination at a facility you are linked to', 403);
    }
    const facility = await prisma.facility.findUnique({
      where: { id: requested, isActive: true },
      select: { id: true },
    });
    if (!facility) throw new AppError('Facility not found or inactive', 404);
    return requested;
  }

  if (linked.length === 1) {
    const only = linked[0]!;
    const facility = await prisma.facility.findUnique({
      where: { id: only, isActive: true },
      select: { id: true },
    });
    if (facility) return only;
  }

  return null;
};

export const recordDose = async (actor: Actor, childId: string, doseId: string, body: RecordDoseBody) => {
  // 1. The child must exist and be visible to this user (otherwise 404)
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    select: { id: true, dateOfBirth: true },
  });
  if (!child) throw new AppError('Child not found', 404);

  // 2. The dose must belong to that child
  const dose = await prisma.childDose.findFirst({ where: { id: doseId, childId: child.id } });
  if (!dose) throw new AppError('Dose not found', 404);

  // 3. Cross-facility access is for new events, not for rewriting another
  //    facility's existing record. Reopening/correcting stays with the facility
  //    that recorded the dose.
  const grant = await getActiveGrantForChild(actor, child.id);
  if (grant && body.action === 'PENDING') {
    throw new AppError(
      'This dose belongs to another facility’s record. Ask that facility to correct it.',
      403
    );
  }

  const today = todayInIst();

  // 4. Apply the rules
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

  // 5. Resolve the facility for this specific event.
  const eventFacilityId = await resolveEventFacility(
    actor,
    cleanText(body.facilityId),
    grant ? grant.facilityId : null
  );

  const isReopen = plan.toStatus === 'PENDING';

  // 6. Update the dose, write the audit row and (for verified cross-facility
  //    access) the access audit together. The update only succeeds if nobody
  //    else changed the dose since we read it.
  await prisma.$transaction(async (tx) => {
    // Re-check the grant inside the transaction: a concurrent re-verification
    // may have moved it to another facility or expired it. Recording must never
    // be attributed to a facility the grant no longer authorizes.
    if (grant) {
      const live = await tx.childAccessGrant.findUnique({
        where: { childId_userId: { childId: child.id, userId: actor.userId } },
        select: { facilityId: true, expiresAt: true, revokedAt: true },
      });
      if (
        !live ||
        live.revokedAt !== null ||
        live.expiresAt.getTime() <= Date.now() ||
        live.facilityId !== grant.facilityId
      ) {
        throw new AppError(
          'Your temporary access to this child changed or expired just now. Verify the child again before recording a dose.',
          409
        );
      }
    }

    const updated = await tx.childDose.updateMany({
      where: { id: dose.id, updatedAt: dose.updatedAt },
      data: {
        recordedStatus: plan.toStatus,
        dueDate: ymdToDate(plan.dueDate),
        administeredOn: plan.administeredOn ? ymdToDate(plan.administeredOn) : null,
        administeredFacilityId: plan.toStatus === 'ADMINISTERED' ? eventFacilityId : null,
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
        facilityId: eventFacilityId,
        changedById: actor.userId,
        note: plan.note,
      },
    });

    if (grant) {
      await tx.childAccessAudit.create({
        data: {
          childId: child.id,
          actorId: actor.userId,
          facilityId: grant.facilityId,
          action: 'CROSS_FACILITY_DOSE_RECORDED',
          // Identifiers and status only: no vaccination-clinic personal data.
          detail: { doseId: dose.id, action: plan.toStatus, facilityId: eventFacilityId },
        },
      });
      await tx.childAccessGrant.update({
        where: { id: grant.id },
        data: { lastUsedAt: new Date() },
      });
    }
  });

  const fresh = await prisma.childDose.findUniqueOrThrow({ where: { id: dose.id }, include: doseInclude });
  return toDoseView(fresh, today);
};

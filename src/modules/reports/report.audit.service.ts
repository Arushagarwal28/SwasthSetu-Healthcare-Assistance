/**
 * Audit trail for report actions.
 *
 * Records *what happened*, never the medical content: no values, units,
 * reference ranges, test names or patient names are stored here. `detail` is
 * limited to structural facts (counts, field names, ids of tests).
 */
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type { JwtPayload } from '../../utils/jwt';

export type AuditAction =
  | 'UPLOAD'
  | 'PARSE_SUCCESS'
  | 'PARSE_FAILURE'
  | 'VIEW'
  | 'EXPORT'
  | 'CORRECT'
  | 'SHARE'
  | 'REVOKE_SHARE'
  | 'COMPARE'
  | 'DELETE';

export interface AuditInput {
  action: AuditAction;
  reportId?: string | null;
  reportRef?: string | null;
  actor?: JwtPayload | null;
  detail?: Prisma.InputJsonValue;
  requestId?: string | null;
}

/** Never let a failed audit write break the user's request. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const data: Prisma.ReportAuditLogUncheckedCreateInput = {
      action: input.action,
      reportId: input.reportId ?? null,
      reportRef: input.reportRef ?? input.reportId ?? null,
      actorId: input.actor?.userId ?? null,
      actorRole: (input.actor?.role as Role | undefined) ?? null,
      requestId: input.requestId ?? null,
    };
    if (input.detail !== undefined) data.detail = input.detail;

    await prisma.reportAuditLog.create({ data });
  } catch {
    // Audit failures are swallowed on purpose: losing a log line must not
    // reveal anything to the caller or fail an otherwise valid operation.
  }
}

export const auditDetail = (facts: Record<string, string | number | boolean | string[]>): Prisma.InputJsonValue =>
  facts as Prisma.InputJsonValue;

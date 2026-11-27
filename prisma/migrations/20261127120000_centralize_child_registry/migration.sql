-- Centralized child vaccination registry
--
-- A child no longer belongs to a facility. Facility truth moves to the event
-- that actually happened at a facility:
--   * child_doses.administeredFacilityId keeps the verified administering facility
--   * child_dose_events.facilityId records where that specific encounter or
--     recording action occurred (nullable: unknown is preserved as unknown)
--
-- The old permanent link is archived (identifiers only, no personal data)
-- before the column is removed. The archive is inert: no runtime code reads it
-- for access control, lists, dashboards or worklists, and rows are purged after
-- a fixed retention period.

-- 1. Event-level encounter facility
ALTER TABLE "child_dose_events" ADD COLUMN "facilityId" TEXT;

-- 2. Archive the real existing assignments before removing the column
CREATE TABLE "child_facility_assignment_archive" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "facilityId" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_facility_assignment_archive_pkey" PRIMARY KEY ("id")
);

INSERT INTO "child_facility_assignment_archive" ("id", "childId", "facilityId", "archivedAt")
SELECT gen_random_uuid(), "id", "assignedFacilityId", CURRENT_TIMESTAMP
FROM "children"
WHERE "assignedFacilityId" IS NOT NULL;

-- 3. Correct historical backfill.
-- Existing event rows never recorded a facility. Only an ADMINISTERED event can
-- be attributed with confidence, and only when the dose has exactly one such
-- event and still carries that facility. Anything else (postponements, not-given
-- decisions, repeated administration, historical doses entered at registration)
-- stays NULL: no facility is invented.
WITH single_administration AS (
    SELECT d."id" AS dose_id, d."administeredFacilityId" AS facility_id
    FROM "child_doses" d
    WHERE d."recordedStatus" = 'ADMINISTERED'
      AND d."administeredFacilityId" IS NOT NULL
      AND (
        SELECT COUNT(*) FROM "child_dose_events" e
        WHERE e."doseId" = d."id" AND e."toStatus" = 'ADMINISTERED'
      ) = 1
)
UPDATE "child_dose_events" e
SET "facilityId" = s.facility_id
FROM single_administration s
WHERE e."doseId" = s.dose_id
  AND e."toStatus" = 'ADMINISTERED';

-- 4. Remove the permanent child-facility association
ALTER TABLE "children" DROP CONSTRAINT "children_assignedFacilityId_fkey";
DROP INDEX "children_assignedFacilityId_idx";
ALTER TABLE "children" DROP COLUMN "assignedFacilityId";

-- 5. Keys for the new shapes
CREATE INDEX "child_dose_events_facilityId_idx" ON "child_dose_events"("facilityId");
CREATE INDEX "child_facility_assignment_archive_childId_idx" ON "child_facility_assignment_archive"("childId");
CREATE INDEX "child_facility_assignment_archive_archivedAt_idx" ON "child_facility_assignment_archive"("archivedAt");

ALTER TABLE "child_dose_events" ADD CONSTRAINT "child_dose_events_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "child_facility_assignment_archive" ADD CONSTRAINT "child_facility_assignment_archive_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Audit the registration grant issued to the registering staff member
ALTER TYPE "ChildAccessAuditAction" ADD VALUE IF NOT EXISTS 'REGISTRATION_GRANT_ISSUED';
